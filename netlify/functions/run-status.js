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

        console.log(`Fetched ${items.length} items from Apify dataset.`);
        if (items.length > 0) {
            console.log('First item structure:', JSON.stringify(items[0], null, 2));
        }

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
            // Normalize Item - Handle multiple possible field names from different actors
            // LOGGING: Check if we are finding the URL
            const url = item.url || item.productUrl || item.product_url || item.canonicalUrl;

            if (!url) {
                console.log('Skipping item with no URL:', JSON.stringify(item));
                continue;
            }

            if (existingUrls.has(url)) {
                duplicateCount++;
                continue;
            }

            const price = item.price || item.price_value || 0;
            const currency = item.currency || item.price_currency || 'GBP';

            // Derive retailer if missing
            let retailer = item.retailer;
            if (!retailer && url) {
                if (url.includes('sephora.co.uk')) retailer = 'Sephora';
                else if (url.includes('boots.com')) retailer = 'Boots';
                else if (url.includes('hollandandbarrett.com')) retailer = 'Holland & Barrett';
                else retailer = 'Unknown';
            }

            newRows.push({
                date_found: new Date().toISOString().split('T')[0],
                retailer: retailer,
                product_name: item.title || item.name || item.productName || item.product_name || '',
                brand: item.brand || '',
                category: item.category || item.breadcrumbs?.[0] || '', // standardized scrapers often have breadcrumbs
                product_url: url,
                price_value: price,
                price_currency: currency,
                price_display: item.price_display || `${currency} ${price}`,
                rating_value: item.rating || item.rating_value || item.stars || '',
                rating_count: item.reviewCount || item.rating_count || item.reviewsCount || item.reviews || '',
                review_snippet: item.review_snippet ? item.review_snippet.substring(0, 200) : (item.description ? item.description.substring(0, 200) : ''),
                run_id: runId,
                scrape_timestamp: new Date().toISOString(),
            });

            // Add to set to prevent duplicates within the same batch
            existingUrls.add(url);
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
