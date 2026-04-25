import { ApifyClient } from 'apify-client';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from './lib/google-auth.js';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
const serviceAccountAuth = getGoogleAuth();

async function salvageRun() {
    const runId = 'hssdYHeReOlbmxb3x';
    console.log(`Fetching items from run ${runId}...`);
    
    const run = await client.run(runId).get();
    const datasetId = run.defaultDatasetId;
    const items = (await client.dataset(datasetId).listItems()).items;
    
    // Filter for actual products (exclude #debug items)
    const products = items.filter(item => item.product_url || item.url);
    console.log(`Found ${products.length} products to sync.`);
    
    if (products.length === 0) {
        console.log('No actual products found in the dataset.');
        return;
    }

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle['Beauty'];
    
    const batchRows = products.map(item => ({
        'date_found': new Date().toISOString().split('T')[0],
        'retailer': item.retailer || 'Holland & Barrett',
        'manufacturer': item.manufacturer || item.product_name?.split(' ')[0] || 'Unknown',
        'product': item.product_name || item.title || 'Unknown',
        'brand': item.brand || 'Unknown',
        'price': item.price_display || 'N/A',
        'reviews': item.reviews || 0,
        'rating_value': item.rating || '0.0',
        'product url': item.product_url || item.url,
        'status': 'New',
        'run_id': runId,
        'scrape_timestamp': new Date().toISOString(),
        'category': 'New In',
        'image_url': item.image_url || ''
    }));

    console.log(`Appending ${batchRows.length} rows to 'New In'...`);
    await sheet.addRows(batchRows);
    console.log('Sync complete!');
}

salvageRun().catch(console.error);
