
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

async function debugRunStatus() {
    try {
        const runs = await client.actor(process.env.APIFY_ACTOR_ID).runs().list({ limit: 1, desc: true });
        const latestRun = runs.items[0];

        if (!latestRun) {
            console.log('No runs found.');
            return;
        }

        console.log(`Checking Run: ${latestRun.id}, Status: ${latestRun.status}`);

        const dataset = await client.run(latestRun.id).dataset();
        const { items } = await dataset.listItems();
        console.log(`Items in dataset: ${items.length}`);

        if (items.length === 0) {
            console.log('No items to process.');
            return;
        }

        // Check if our filter is too aggressive
        const totalItems = items.length;
        const shadeItems = items.filter(i => {
            const name = i.title || i.name || i.productName || i.product_name || '';
            return name.toLowerCase().includes('choose a shade');
        });

        console.log(`Total Items: ${totalItems}`);
        console.log(`"Choose a shade" Items Filtered: ${shadeItems.length}`);

        if (totalItems > 0 && totalItems === shadeItems.length) {
            console.warn('CRITICAL: ALL items were filtered out as "Choose a shade"!');
        }

    } catch (e) {
        console.error(e);
    }
}

debugRunStatus();
