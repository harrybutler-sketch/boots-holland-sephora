import 'dotenv/config';
import { ApifyClient } from 'apify-client';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// logic copied and adapted from netlify/functions/run-status.js
async function processRunLocally(runId) {
    console.log(`🚀 Starting local processing for Run ID: ${runId}`);

    const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

    try {
        console.log('Fetching run...');
        const run = await client.run(runId).get();

        if (!run) {
            console.error('Run not found');
            return;
        }

        console.log(`Run Status: ${run.status}`);
        if (run.status !== 'SUCCEEDED') {
            console.log('Run not succeeded. Dataset ID:', run.defaultDatasetId);
            return;
        }

        // Run succeeded, process data
        console.log(`Fetching dataset ${run.defaultDatasetId}...`);
        const dataset = await client.dataset(run.defaultDatasetId).listItems();
        const items = dataset.items;
        console.log(`Fetched ${items.length} items from Apify.`);

        if (items.length > 0) {
            console.log('First item sample:', JSON.stringify(items[0], null, 2));
        }

        // Google Sheets Auth
        console.log('Connecting to Google Sheets...');
        const serviceAccountAuth = new JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY.replace(/\\n/g, '\n'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        console.log(`Sheet: ${sheet.title}`);

        // Fetch existing rows
        console.log('Fetching existing rows for dedup...');
        const rows = await sheet.getRows();
        // FIXED: Use 'product url' with space
        const existingUrls = new Set(rows.map((row) => row.get('product url')));
        console.log(`Found ${existingUrls.size} existing rows.`);

        let duplicateCount = 0;
        const newRows = [];

        for (const item of items) {
            const url = item.url || item.productUrl || item.product_url || item.canonicalUrl;

            if (!url) {
                // console.log('Skipping item with no URL');
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

            // Using logic from run-status.js
            newRows.push({
                'product': item.title || item.name || item.productName || item.product_name || '',
                'retailer': retailer,
                'product url': url,
                'price': item.price_display || `${currency} ${price}`,
                'reviews': item.reviewCount || item.rating_count || item.reviewsCount || item.reviews || '',
                'date_found': new Date().toISOString().split('T')[0],
                'brand': (typeof item.brand === 'string' ? item.brand : (item.brand && item.brand.name)) || '',
                'category': item.category || item.breadcrumbs?.[0] || '',
                'rating_value': item.rating || item.rating_value || item.stars || (item.aggregateRating && item.aggregateRating.ratingValue) || '',
                'run_id': runId,
                'scrape_timestamp': new Date().toISOString(),
            });

            existingUrls.add(url);
        }

        console.log(`Prepared ${newRows.length} new rows to add (${duplicateCount} duplicates).`);

        if (newRows.length > 0) {
            console.log('Adding rows to sheet...');
            // Batch write to avoid timeouts/limits (same as run-status.js)
            const BATCH_SIZE = 50;
            for (let i = 0; i < newRows.length; i += BATCH_SIZE) {
                const chunk = newRows.slice(i, i + BATCH_SIZE);
                console.log(`Writing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(newRows.length / BATCH_SIZE)}...`);
                await sheet.addRows(chunk);
            }
            console.log('✅ Successfully added rows!');
        } else {
            console.log('✅ No new rows to add.');
        }

    } catch (error) {
        console.error('❌ Error processing run:', error);
    }
}

// Run ID from Step 1035
processRunLocally('E27iC1Q8jIdoyZSrE');
