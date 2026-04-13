import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

// Load Credentials
const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function syncRunToSheet(runId) {
    console.log(`Starting manual sync for Run: ${runId}`);
    
    // 1. Fetch Data from Apify
    const run = await client.run(runId).get();
    if (!run) throw new Error('Run not found');
    
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    const products = items.filter(i => i.product_name || i.productName);
    console.log(`Found ${products.length} products to sync.`);

    if (products.length === 0) return;

    // 2. Load Google Sheet
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
    await doc.loadInfo();
    const beautySheet = doc.sheetsByTitle['Beauty'];
    const grocerySheet = doc.sheetsByTitle['Grocery'];

    // 3. Prepare Rows
    const beautyRows = [];
    const groceryRows = [];

    for (const item of products) {
        const cleanItem = {
            'date_found': item.date_found ? item.date_found.split('T')[0] : new Date().toISOString().split('T')[0],
            'retailer': item.retailer || 'N/A',
            'manufacturer': (item.manufacturer || '').replace(/\n/g, ' ').trim(),
            'product': (item.product_name || item.productName || '').replace(/\n/g, ' ').trim(),
            'brand': (item.brand || '').replace(/\n/g, ' ').trim(),
            'price': item.price_display || 'N/A',
            'rating_value': item.rating || '0.0',
            'reviews': item.reviews || 0,
            'product url': item.product_url || '',
            'image_url': item.image_url || '',
            'status': 'New',
            'run_id': runId,
            'scrape_timestamp': new Date().toISOString()
        };

        const r = cleanItem.retailer.toLowerCase();
        if (r.includes('sephora') || r.includes('holland') || r.includes('boots') || r.includes('superdrug')) {
            beautyRows.push(cleanItem);
        } else {
            groceryRows.push(cleanItem);
        }
    }

    // 4. Add Rows in Batch
    if (beautyRows.length > 0) {
        console.log(`Adding ${beautyRows.length} rows to Beauty...`);
        await beautySheet.addRows(beautyRows);
    }
    if (groceryRows.length > 0) {
        console.log(`Adding ${groceryRows.length} rows to Grocery...`);
        await grocerySheet.addRows(groceryRows);
    }

    console.log('Manual sync complete!');
}

const RUN_ID = '61PKU4NXw0W3NXlqd';
syncRunToSheet(RUN_ID).catch(console.error);
