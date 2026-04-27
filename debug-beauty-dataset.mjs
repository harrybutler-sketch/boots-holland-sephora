import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

async function checkBeautyData() {
    const runId = 'hssdYHeReOlbmxb3x';
    const run = await client.run(runId).get();
    console.log(`Run status: ${run.status}`);
    const datasetId = run.defaultDatasetId;
    const items = (await client.dataset(datasetId).listItems()).items;
    console.log(`Total items found: ${items.length}`);
    
    if (items.length > 0) {
        console.log('--- SAMPLE ITEM ---');
        console.log(JSON.stringify(items[0], null, 2));
        
        // Check for specific fields required by run-status.js
        console.log('\n--- SYNC FIELD CHECK ---');
        console.log('url:', items[0].product_url || items[0].url);
        console.log('product_name:', items[0].product_name || items[0].title || items[0].name);
        console.log('retailer:', items[0].retailer);
    }
}

checkBeautyData();
