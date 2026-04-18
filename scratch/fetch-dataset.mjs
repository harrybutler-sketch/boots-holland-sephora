import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN
});

async function checkDataset() {
    const runId = '61PKU4NXw0W3NXlqd';
    const run = await client.run(runId).get();
    if (!run) {
        // Try case sensitivity check
        console.log('Run not found with strict ID. Trying list search...');
        return;
    }
    
    console.log('Fetching dataset items for:', run.defaultDatasetId);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    console.log(`Found ${items.length} items.`);
    if (items.length > 0) {
        console.log('Sample Item:', JSON.stringify(items[0], null, 2));
    }
}

checkDataset().catch(console.error);
