import { ApifyClient } from 'apify-client';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from '../../lib/google-auth.js';

export const handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const queryParams = event.queryStringParameters || {};
        let { runId, workspace = 'beauty' } = queryParams;

        // Extract runId from Apify webhook payload if present
        let body;
        try {
            body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        } catch (e) {
            console.error('Failed to parse body', e);
        }

        if (body && body.eventData && body.eventData.actorRunId) {
            runId = body.eventData.actorRunId;
        }

        if (!runId) {
            return { statusCode: 400, body: JSON.stringify({ error: 'runId is required' }) };
        }

        const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
        const run = await client.run(runId).get();

        if (!run) {
            return { statusCode: 404, body: JSON.stringify({ error: 'Run not found' }) };
        }

        if (run.status !== 'SUCCEEDED') {
            return { statusCode: 200, body: JSON.stringify({ status: run.status, message: 'Scrape not finished or failed.' }) };
        }

        const datasetId = run.defaultDatasetId;
        const items = (await client.dataset(datasetId).listItems()).items;

        console.log(`Fetched ${items.length} items from Google Search dataset.`);

        if (items.length === 0) {
            return { statusCode: 200, body: JSON.stringify({ status: 'SUCCEEDED', message: 'No results found.' }) };
        }

        // Map results back to brands
        const brandContacts = {};

        for (const item of items) {
            const query = item.searchQuery && item.searchQuery.term ? item.searchQuery.term : '';
            // query looks like: site:linkedin.com/in "Brand Name" AND ("Founder" OR "CEO" OR "Director" OR "Head")
            const brandMatch = query.match(/"([^"]+)"/);
            const brand = brandMatch ? brandMatch[1] : null;

            if (brand && item.organicResults && item.organicResults.length > 0) {
                // Get top result
                const topResult = item.organicResults[0];
                const url = topResult.url;
                let name = topResult.title.split(' - ')[0].trim();
                
                // Clean up name (e.g. "John Doe - Founder")
                if (name.includes('|')) name = name.split('|')[0].trim();

                brandContacts[brand] = {
                    name: name,
                    url: url
                };
            }
        }

        if (Object.keys(brandContacts).length === 0) {
            return { statusCode: 200, body: JSON.stringify({ status: 'SUCCEEDED', message: 'Could not extract any valid contacts.' }) };
        }

        console.log('Found contacts:', brandContacts);

        // Update Google Sheets
        const serviceAccountAuth = getGoogleAuth();
        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();

        const sheetTitle = workspace === 'grocery' ? 'Grocery' : (workspace === 'lifestyle' ? 'Lifestyle' : 'New In');
        const sheet = doc.sheetsByTitle[sheetTitle];

        if (!sheet) {
            return { statusCode: 404, body: JSON.stringify({ error: `Sheet ${sheetTitle} not found.` }) };
        }

        await sheet.loadHeaderRow();
        const headers = sheet.headerValues;

        if (!headers.includes('Contact Name')) {
            console.log('Adding Contact Name column...');
            headers.push('Contact Name');
        }
        if (!headers.includes('Contact LinkedIn')) {
            console.log('Adding Contact LinkedIn column...');
            headers.push('Contact LinkedIn');
        }

        await sheet.setHeaderRow(headers);

        const rows = await sheet.getRows();
        let updatedCount = 0;

        for (const row of rows) {
            const rowBrand = row.get('Brand') || row.get('brand');
            const rowMfn = row.get('Manufacturer') || row.get('manufacturer');
            
            let matchedBrand = null;
            for (const b of Object.keys(brandContacts)) {
                if ((rowBrand && rowBrand === b) || (rowMfn && rowMfn === b)) {
                    matchedBrand = b;
                    break;
                }
            }

            if (matchedBrand) {
                const contact = brandContacts[matchedBrand];
                // Only update if not already set or if different
                const existingName = row.get('Contact Name');
                if (existingName !== contact.name) {
                    row.set('Contact Name', contact.name);
                    row.set('Contact LinkedIn', contact.url);
                    await row.save();
                    updatedCount++;
                }
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                status: 'SUCCEEDED',
                updatedRows: updatedCount,
                contactsFound: Object.keys(brandContacts).length
            })
        };

    } catch (error) {
        console.error('Error handling contact webhook:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
    }
};
