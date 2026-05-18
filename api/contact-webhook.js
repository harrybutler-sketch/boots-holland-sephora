import { ApifyClient } from 'apify-client';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from '../lib/google-auth.js';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).send('Method Not Allowed');
    }

    try {
        let { runId, workspace = 'beauty' } = request.query;

        // Extract runId from Apify webhook payload if present
        const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
        if (body && body.eventData && body.eventData.actorRunId) {
            runId = body.eventData.actorRunId;
        }

        if (!runId) {
            return response.status(400).json({ error: 'runId is required' });
        }

        const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
        const run = await client.run(runId).get();

        if (!run) {
            return response.status(404).json({ error: 'Run not found' });
        }

        if (run.status !== 'SUCCEEDED') {
            return response.status(200).json({ status: run.status, message: 'Scrape not finished or failed.' });
        }

        const datasetId = run.defaultDatasetId;
        const items = (await client.dataset(datasetId).listItems()).items;

        console.log(`Fetched ${items.length} items from Google Search dataset.`);

        if (items.length === 0) {
            return response.status(200).json({ status: 'SUCCEEDED', message: 'No results found.' });
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
            return response.status(200).json({ status: 'SUCCEEDED', message: 'Could not extract any valid contacts.' });
        }

        console.log('Found contacts:', brandContacts);

        // Update Google Sheets
        const serviceAccountAuth = getGoogleAuth();
        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();

        const sheetTitle = workspace === 'grocery' ? 'Grocery' : (workspace === 'lifestyle' ? 'Lifestyle' : 'New In');
        const sheet = doc.sheetsByTitle[sheetTitle];

        if (!sheet) {
            return response.status(404).json({ error: `Sheet ${sheetTitle} not found.` });
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

        return response.status(200).json({
            status: 'SUCCEEDED',
            updatedRows: updatedCount,
            contactsFound: Object.keys(brandContacts).length
        });

    } catch (error) {
        console.error('Error handling contact webhook:', error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
}
