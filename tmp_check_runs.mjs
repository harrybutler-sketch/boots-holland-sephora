import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

async function checkRun(runId) {
    const run = await client.run(runId).get();
    console.log(`Run: ${runId}`);
    console.log(`Status: ${run.status}`);
    console.log(`Dataset ID: ${run.defaultDatasetId}`);
    
    const dataset = await client.dataset(run.defaultDatasetId).listItems();
    console.log(`Items found: ${dataset.items.length}`);
    if (dataset.items.length > 0) {
        console.log('Sample item:', JSON.stringify(dataset.items[0], null, 2));
    }
}

checkRun('7PxKNwdt6ODMcEMso');
checkRun('0avD6Ofn6vwAiNQ8L'); // The buylist one
