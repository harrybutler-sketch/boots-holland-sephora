import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

async function checkFailed() {
    const runs = await client.actor('apify/puppeteer-scraper').runs().list({ limit: 5, desc: true });
    for (const run of runs.items) {
        console.log(`Run ID: ${run.id}, Status: ${run.status}, Finished: ${run.finishedAt}`);
        const input = await client.keyValueStore(run.defaultKeyValueStoreId).getRecord('INPUT');
        if (input && input.value && input.value.startUrls) {
            console.log('Start URLs:', JSON.stringify(input.value.startUrls, null, 2));
        }
    }
}
checkFailed().catch(console.error);
