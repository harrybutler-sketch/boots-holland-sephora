// Manual sync script - run this to sync the latest Apify run to Google Sheets
import { ApifyClient } from 'apify-client';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from './lib/google-auth.js';
import dotenv from 'dotenv';

dotenv.config();

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

if (!APIFY_TOKEN || !GOOGLE_SHEET_ID) {
    console.error('Missing environment variables!');
    process.exit(1);
}

const client = new ApifyClient({ token: APIFY_TOKEN });

// Get the latest run
const runs = await client.actor('apify/puppeteer-scraper').runs().list({ limit: 5 });
console.log('\n=== Recent Runs ===');
runs.items.forEach((run, i) => {
    console.log(`${i + 1}. ${run.id} - ${run.status} (Started: ${run.startedAt})`);
});

const latestRun = runs.items[0];
console.log(`\n=== Syncing Latest Run: ${latestRun.id} ===`);
console.log(`Status: ${latestRun.status}`);

if (latestRun.status !== 'SUCCEEDED') {
    console.log('Run has not succeeded yet. Exiting.');
    process.exit(0);
}

// Fetch dataset
const dataset = await client.dataset(latestRun.defaultDatasetId).listItems();
const items = dataset.items;

console.log(`\nFetched ${items.length} items from dataset`);

if (items.length === 0) {
    console.log('No items to sync!');
    process.exit(0);
}

console.log('\nFirst item sample:', JSON.stringify(items[0], null, 2));

// Sync to Google Sheets
const serviceAccountAuth = getGoogleAuth();
const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, serviceAccountAuth);
await doc.loadInfo();

const sheet = doc.sheetsByTitle['New In'];
if (!sheet) {
    console.error('Sheet "New In" not found!');
    process.exit(1);
}

const rows = await sheet.getRows();
const existingUrls = new Set(rows.map(r => r.get('Product URL')).filter(Boolean));

let newCount = 0;
const newRows = [];

for (const item of items) {
    const url = item.url || item.productUrl;
    if (!url || existingUrls.has(url)) continue;

    newRows.push({
        'Date Found': new Date().toISOString().split('T')[0],
        'Retailer': item.retailer || '',
        'Manufacturer': item.brand || '',
        'Product': item.name || '',
        'Brand': item.brand || '',
        'Price': item.price || '',
        'Review Count': item.reviews || 0,
        'Rating': item.rating || 0,
        'Product URL': url,
        'Status': 'New',
        'Run ID': latestRun.id,
        'Timestamp': new Date().toISOString()
    });
    newCount++;
}

if (newRows.length > 0) {
    await sheet.addRows(newRows);
    console.log(`\n✅ Added ${newRows.length} new products to Google Sheets!`);
} else {
    console.log('\n⚠️ No new products to add (all were duplicates)');
}

console.log(`\nDone! Total items processed: ${items.length}, New items added: ${newCount}`);
