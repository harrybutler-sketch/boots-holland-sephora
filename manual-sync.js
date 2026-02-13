import { ApifyClient } from 'apify-client';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
dotenv.config();

function getGoogleAuth() {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

    if (!email || !key) {
        throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_KEY');
    }
    if (key.startsWith('"') && key.endsWith('"')) key = key.slice(1, -1);
    key = key.replace(/\\n/g, '\n');
    return new JWT({
        email,
        key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
}

// The Enriched Run ID from the previous manual step
const runId = 'q4nV7RjJzdKk2xKOo';

async function syncToSheet() {
    console.log(`Syncing data from run ${runId} to Google Sheet...`);

    const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
    const run = await client.run(runId).get();

    // Fetch items
    const dataset = await client.dataset(run.defaultDatasetId).listItems();
    const items = dataset.items;
    console.log(`Fetched ${items.length} items from Apify.`);

    if (items.length === 0) {
        console.log('No items to sync.');
        return;
    }

    // Connect to Sheet
    const serviceAccountAuth = getGoogleAuth();
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();

    const sheetTitle = 'New In';
    const sheet = doc.sheetsByTitle[sheetTitle];

    // Fetch existing rows for deduplication
    const rows = await sheet.getRows();
    const existingUrls = new Set(rows.map(r => r.get('product url')));

    const newRows = [];
    let duplicateCount = 0;

    for (const item of items) {
        // Handle various URL fields from different actors
        const url = item.url || item.productUrl || (item.userData && item.userData.url);

        if (!url || existingUrls.has(url)) {
            duplicateCount++;
            continue;
        }

        // Robust extraction (mimicking run-status.js logic)
        const name = item.title || item.name || (item.userData && item.userData.title) || '';
        const retailer = item.retailer || (item.userData && item.userData.retailer) || 'Sephora'; // Default to Sephora for this run
        const price = item.price || item.price_display || (item.userData && item.userData.price) || '';

        // The important part: Reviews from enrichment
        const reviews = item.reviews || (item.userData && item.userData.reviews) || 0;
        const rating = item.rating || (item.userData && item.userData.rating) || '';
        const image = item.image || (item.userData && item.userData.image) || '';

        newRows.push({
            'date_found': new Date().toISOString().split('T')[0],
            'retailer': retailer,
            'manufacturer': item.manufacturer || '',
            'product': name,
            'brand': item.brand || '',
            'price': price,
            'reviews': reviews,
            'rating_value': rating,
            'product url': url,
            'status': 'Pending',
            'run_id': runId,
            'scrape_timestamp': new Date().toISOString(),
            'image_url': image
        });

        existingUrls.add(url);
    }

    console.log(`Prepared ${newRows.length} new rows (skipped ${duplicateCount} duplicates).`);

    if (newRows.length > 0) {
        await sheet.addRows(newRows);
        console.log('Successfully added rows to Google Sheet! ✅');
    }
}

syncToSheet();
