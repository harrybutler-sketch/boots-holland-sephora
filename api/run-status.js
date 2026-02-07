import { ApifyClient } from 'apify-client';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from '../lib/google-auth.js';

export default async function handler(request, response) {
    if (request.method !== 'GET') {
        return response.status(405).send('Method Not Allowed');
    }

    const { runId } = request.query;
    if (!runId) {
        return response.status(400).json({ error: 'runId is required' });
    }

    const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

    try {
        const run = await client.run(runId).get();

        if (!run) {
            return response.status(404).json({ error: 'Run not found' });
        }

        if (run.status !== 'SUCCEEDED') {
            return response.status(200).json({
                status: run.status,
                datasetId: run.defaultDatasetId,
            });
        }

        // Run succeeded, process data
        const dataset = await client.dataset(run.defaultDatasetId).listItems();
        const items = dataset.items;

        console.log(`Fetched ${items.length} items from Apify dataset.`);
        if (items.length > 0) {
            console.log('First item structure:', JSON.stringify(items[0], null, 2));
        }

        // Google Sheets Auth
        const serviceAccountAuth = getGoogleAuth();

        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];

        // Fetch existing rows for deduplication
        const rows = await sheet.getRows();
        // FIXED: Use 'product url' (space) not 'product_url'
        const existingUrls = new Set(rows.map((row) => row.get('product url')));

        let appendedCount = 0;
        let duplicateCount = 0;
        const newRows = [];

        for (const item of items) {
            const url = item.url || item.productUrl || item.product_url || item.canonicalUrl;

            if (!url) {
                console.log('Skipping item with no URL:', JSON.stringify(item));
                continue;
            }

            if (existingUrls.has(url)) {
                duplicateCount++;
                continue;
            }

            const price = item.price || item.price_value || (item.offers && item.offers.price) || 0;
            const currency = item.currency || item.price_currency || (item.offers && item.offers.priceCurrency) || 'GBP';

            let retailer = item.retailer;
            if (!retailer && url) {
                if (url.includes('sephora.co.uk')) retailer = 'Sephora';
                else if (url.includes('boots.com')) retailer = 'Boots';
                else if (url.includes('hollandandbarrett.com')) retailer = 'Holland & Barrett';
                else retailer = 'Unknown';
            }

            const name = item.title || item.name || item.productName || item.product_name || '';

            if (!name) {
                console.log('Skipping item with no product name:', JSON.stringify(item));
                continue;
            }

            newRows.push({
                'product': name,
                'retailer': retailer,
                'product url': url,
                'price': item.price_display || `${currency} ${price}`,
                'reviews': item.reviewCount || item.rating_count || item.reviewsCount || item.reviews || '',
                // Keeping other fields as potential extras
                'date_found': new Date().toISOString().split('T')[0],
                'brand': (typeof item.brand === 'string' ? item.brand : (item.brand && item.brand.name)) || '',
                'category': item.category || item.breadcrumbs?.[0] || '',
                'rating_value': item.rating || item.rating_value || item.stars || (item.aggregateRating && item.aggregateRating.ratingValue) || '',
                'status': 'Pending',
                'run_id': runId,
                'scrape_timestamp': new Date().toISOString(),
            });

            existingUrls.add(url);
        }

        // Batch write to avoid timeouts/limits
        if (newRows.length > 0) {
            const BATCH_SIZE = 50;
            for (let i = 0; i < newRows.length; i += BATCH_SIZE) {
                const chunk = newRows.slice(i, i + BATCH_SIZE);
                console.log(`Writing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(newRows.length / BATCH_SIZE)}...`);
                await sheet.addRows(chunk);
            }
            appendedCount = newRows.length;
        }

        return response.status(200).json({
            status: 'SUCCEEDED',
            datasetId: run.defaultDatasetId,
            itemCount: items.length,
            appendedCount,
            duplicateCount,
            lastUpdated: new Date().toISOString(),
        });

    } catch (error) {
        console.error('Error checking status:', error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
}
