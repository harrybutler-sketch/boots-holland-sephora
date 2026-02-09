
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

async function dumpEntireItem() {
    const runId = 'Dfn0Dr6NqkJC9fkaE';
    try {
        const dataset = await client.run(runId).dataset();
        const { items } = await dataset.listItems();

        if (items.length > 0) {
            console.log('--- ENTIRE ITEM START ---');
            console.log(JSON.stringify(items[0], null, 2));
            console.log('--- ENTIRE ITEM END ---');
        } else {
            console.log('No items found in dataset');
        }
    } catch (e) {
        console.error(e);
    }
}

dumpEntireItem();
