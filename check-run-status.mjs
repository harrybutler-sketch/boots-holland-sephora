import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
const runId = process.argv[2] || 'CBl8K8lgAfImWVD6r';

async function checkStatus() {
    const run = await client.run(runId).get();
    console.log(`Run ${runId} Status: ${run.status}`);
    if (run.status === 'SUCCEEDED') {
        console.log(`Dataset ID: ${run.defaultDatasetId}`);
    }
}

checkStatus();
