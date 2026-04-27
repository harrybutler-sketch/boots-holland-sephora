import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

async function checkBeautyRun() {
    const runs = await client.actor('apify/puppeteer-scraper').runs().list({ limit: 5, desc: true });
    
    for (const run of runs.items) {
        console.log(`\nRun ID: ${run.id}`);
        console.log(`Status: ${run.status}`);
        console.log(`Started: ${run.startedAt}`);
        console.log(`Finished: ${run.finishedAt}`);
        console.log(`Results: ${run.itemCount}`);
        
        if (run.itemCount > 0) {
            const items = (await client.dataset(run.defaultDatasetId).listItems({ limit: 5 })).items;
            console.log('Sample Data Key Names:', Object.keys(items[0] || {}));
            console.log('Sample Item URL:', items[0]?.product_url || items[0]?.url);
        }
    }
}

checkBeautyRun();
