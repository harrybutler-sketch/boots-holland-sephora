
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

async function fetchRunItems() {
    try {
        const runId = 'VnAbM0jJHvgr2seHT';
        console.log(`Fetching items for run: ${runId}`);
        const dataset = await client.run(runId).dataset();
        const { items } = await dataset.listItems({ limit: 5 });
        console.log(JSON.stringify(items, null, 2));
    } catch (e) {
        console.error(e);
    }
}

fetchRunItems();
