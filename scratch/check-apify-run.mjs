import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN
});

async function checkRun() {
    const runId = '61PKU4NXW0W3NXlqd';
    const run = await client.run(runId).get();
    console.log('Run Info:', JSON.stringify(run, null, 2));
    
    const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 2 });
    console.log('Sample Items:', JSON.stringify(items, null, 2));
}

checkRun().catch(console.error);
