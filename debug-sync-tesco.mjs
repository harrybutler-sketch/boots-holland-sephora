
import { ApifyClient } from 'apify-client';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from './lib/google-auth.js';
import dotenv from 'dotenv';
dotenv.config();

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const runId = '9KAjaj0XpuSxnccg0';

async function debugSync() {
    const client = new ApifyClient({ token: APIFY_TOKEN });
    const run = await client.run(runId).get();
    const dataset = await client.dataset(run.defaultDatasetId).listItems();
    const items = dataset.items;

    console.log(`Analyzing Dataset: ${items.length} items`);

    const serviceAccountAuth = getGoogleAuth();
    const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();

    console.log('Sheet Tabs found:', doc.sheetsByIndex.map(s => `'${s.title}'`).join(', '));

    const grocerySheet = doc.sheetsByTitle['Grocery'];
    if (!grocerySheet) console.error('CRITICAL: "Grocery" tab NOT FOUND. Matches must be exact.');

    for (const item of items) {
        console.log(`\n--- Item: ${item.name || item.title} ---`);
        
        const url = item.url || item.productUrl || item.product_url || item.canonicalUrl;
        if (!url) { console.log('SKIPPED: No URL found'); continue; }

        let name = item.title || item.name || item.productName || item.product_name || '';
        if (!name) { console.log('SKIPPED: No Name found'); continue; }
        if (name.toLowerCase().includes('choose a shade')) { console.log('SKIPPED: "Choose a shade" detected'); continue; }

        const retailer = 'Tesco';
        const isGrocery = true; // Hardcoded for this debug of Tesco run
        const targetSheet = grocerySheet;

        if (!targetSheet) { console.log('SKIPPED: Target sheet ("Grocery") is NULL'); continue; }

        // Own Brand logic check
        const brandKeywords = ['tesco', 'stockwell', 'ms molly', 'finest'];
        const brandName = name.split(' ')[0]; // Simplified brand extraction for debug
        const manufacturer = brandName;
        const isOwnBrand = brandKeywords.some(kw => name.toLowerCase().includes(kw) || brandName.toLowerCase().includes(kw));

        if (isOwnBrand) {
            console.log(`SKIPPED: Own Brand detected ("${brandName}")`);
            continue;
        }

        console.log(`VALID: Passed all filters. Brand: ${brandName}, Price: ${item.price}`);
    }
}

debugSync();
