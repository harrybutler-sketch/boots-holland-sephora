const { ApifyClient } = require('apify-client');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { runId } = event.queryStringParameters;
    if (!runId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'runId is required' }) };
    }

    const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

    try {
        const run = await client.run(runId).get();

        if (!run) {
            return { statusCode: 404, body: JSON.stringify({ error: 'Run not found' }) };
        }

        if (run.status !== 'SUCCEEDED') {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    status: run.status,
                    datasetId: run.defaultDatasetId,
                }),
            };
        }

        // Run succeeded, process data
        const dataset = await client.dataset(run.defaultDatasetId).listItems();
        const items = dataset.items;

        // Google Sheets Auth
        const serviceAccountAuth = new JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY.replace(/\\n/g, '\n'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0]; // Assuming first sheet

        // Fetch existing rows for deduplication
        const rows = await sheet.getRows();
        const existingUrls = new Set(rows.map((row) => row.get('product_url')));

        let appendedCount = 0;
        let duplicateCount = 0;
        const newRows = [];

        for (const item of items) {
            if (!item.product_url) continue;

            if (existingUrls.has(item.product_url)) {
                duplicateCount++;
                continue;
            }

            // Normalize Item
            newRows.push({
                date_found: new Date().toISOString().split('T')[0],
                retailer: item.retailer || 'Unknown', // Should come from userData or scrape
                product_name: item.product_name,
                brand: item.brand,
                category: item.category,
                product_url: item.product_url,
                price_value: item.price_value,
                price_currency: item.price_currency || 'GBP',
                price_display: item.price_display,
                rating_value: item.rating_value,
                rating_count: item.rating_count,
                review_snippet: item.review_snippet ? item.review_snippet.substring(0, 200) : '',
                run_id: runId,
                scrape_timestamp: new Date().toISOString(),
            });

            // Add to set to prevent duplicates within the same batch
            existingUrls.add(item.product_url);
        }

        if (newRows.length > 0) {
            await sheet.addRows(newRows);
            appendedCount = newRows.length;
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                status: 'SUCCEEDED',
                datasetId: run.defaultDatasetId,
                itemCount: items.length,
                appendedCount,
                duplicateCount,
                lastUpdated: new Date().toISOString(),
            }),
        };

    } catch (error) {
        console.error('Error checking status:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal Server Error' }),
        };
    }
};
