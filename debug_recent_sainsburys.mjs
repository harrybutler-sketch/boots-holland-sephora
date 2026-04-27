import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

async function debugRecentSainsburys() {
    console.log('Inspecting most recent Sainsbury\'s run Attempts...');
    
    // Fetch recent runs
    const runs = await client.actor('apify/puppeteer-scraper').runs().list({ limit: 10, desc: true });
    
    for (const run of runs.items) {
        // Fetch input from key-value store
        const kvs = client.keyValueStore(run.defaultKeyValueStoreId);
        const inputRecord = await kvs.getRecord('INPUT');
        const input = inputRecord ? inputRecord.value : {};
        const targetsSainsburys = JSON.stringify(input).includes('sainsburys.co.uk');
        
        if (targetsSainsburys) {
            console.log(`Run ID: ${run.id}, Status: ${run.status}, Date: ${run.finishedAt}`);
            if (run.status !== 'SUCCEEDED') {
                const log = await client.log(run.id).get();
                console.log('Log snippet:', log ? log.substring(0, 1000) : 'No log');
            } else {
                const datasets = await client.dataset(run.defaultDatasetId).listItems({ limit: 5 });
                console.log('Sample Data:', JSON.stringify(datasets.items, null, 2));
            }
            // return; // Only check the most recent one
        }
    }
}

debugRecentSainsburys().catch(console.error);
