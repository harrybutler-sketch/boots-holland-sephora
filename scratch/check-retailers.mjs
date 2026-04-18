import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN
});

async function checkRetailers() {
    const runId = '61PKU4NXw0W3NXlqd';
    const run = await client.run(runId).get();
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    const retailers = [...new Set(items.map(i => i.retailer).filter(Boolean))];
    console.log('Retailers in this run:', retailers);
}

checkRetailers().catch(console.error);
