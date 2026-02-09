
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

async function testSingleScrape() {
    const url = 'https://www.sephora.co.uk/p/glossier-you-duo-perfume-gift-set';
    console.log(`Scraping target: ${url}`);

    try {
        const run = await client.actor(process.env.APIFY_ACTOR_ID).start({
            listingUrls: [{ url, userData: { retailer: 'Sephora' } }],
            scrapeMode: 'BROWSER',
            maxProductResults: 1,
            proxyConfiguration: { useApifyProxy: true },
            wait_ms: 10000 // Wait for reviews to load
        });

        console.log(`Run started: ${run.id}`);
        console.log(`Waiting for results...`);

        const finishedRun = await client.run(run.id).waitForFinish();
        console.log('Run finished with status:', finishedRun.status);

        const dataset = await client.run(run.id).dataset();
        const { items } = await dataset.listItems();

        if (items.length > 0) {
            console.log('Extracted Item Data:', JSON.stringify(items[0], null, 2));
        } else {
            console.log('No items extracted.');
        }

    } catch (e) {
        console.error(e);
    }
}

testSingleScrape();
