import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN
});

async function checkDataset() {
    const runId = '61PKU4NXw0W3NXlqd';
    const run = await client.run(runId).get();
    
    console.log('Fetching dataset items...');
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    const products = items.filter(i => i.product_name || i.productName);
    console.log(`Found ${products.length} product items out of ${items.length} total.`);
    if (products.length > 0) {
        console.log('Sample Product:', JSON.stringify(products[0], null, 2));
    }
}

checkDataset().catch(console.error);
