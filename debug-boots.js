
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

async function analyzeBootsRun() {
    try {
        console.log('Fetching last 10 runs to find a Boots run...');
        const runs = await client.runs().list({ limit: 10, desc: true });

        let bootsRunId = null;

        for (const run of runs.items) {
            const inputRecord = await client.keyValueStore(run.defaultKeyValueStoreId).getRecord('INPUT');
            if (inputRecord && inputRecord.value) {
                const urls = inputRecord.value.startUrls || inputRecord.value.listingUrls || [];
                const isBoots = urls.some(u => u.url && u.url.includes('boots.com'));

                if (isBoots) {
                    console.log(`Found Boots Run ID: ${run.id}`);
                    bootsRunId = run.id;
                    break;
                }
            }
        }

        if (!bootsRunId) {
            console.log('No recent Boots run found.');
            return;
        }

        const dataset = await client.run(bootsRunId).dataset();
        const { items } = await dataset.listItems({ limit: 5 });

        console.log('--- SAMPLE BOOTS ITEM ---');
        console.log(JSON.stringify(items[0], null, 2));

        // Check for specific "Boots Logo" issue
        const badItem = items.find(i =>
            (i.brand === 'Boots Logo') ||
            (i.manufacturer === 'Boots Logo') ||
            (i.brand && i.brand.name === 'Boots Logo')
        );

        if (badItem) {
            console.log('--- ITEM WITH "Boots Logo" BRAND ---');
            console.log(JSON.stringify(badItem, null, 2));
        } else {
            console.log('No item with "Boots Logo" found in first 5. Checking more...');
            const allItems = await dataset.listItems();
            const found = allItems.items.find(i => JSON.stringify(i).includes('Boots Logo'));
            if (found) {
                console.log('Found one deeper in dataset:', JSON.stringify(found, null, 2));
            }
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

analyzeBootsRun();
