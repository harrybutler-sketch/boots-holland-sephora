import 'dotenv/config';
import { ApifyClient } from 'apify-client';

async function inspectLastRun() {
    try {
        console.log('Connecting to Apify...');
        if (!process.env.APIFY_TOKEN) {
            throw new Error('APIFY_TOKEN is missing from .env');
        }

        const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

        // List runs (sorted by desc startedAt)
        const runsList = await client.runs().list({ limit: 5, desc: true });

        if (!runsList.items || runsList.items.length === 0) {
            console.log('No runs found on this account.');
            return;
        }

        // Find the last SUCCEEDED run if possible, otherwise just the last run
        const lastRun = runsList.items.find(r => r.status === 'SUCCEEDED') || runsList.items[0];

        console.log('--------------------------------------------------');
        console.log(`Run ID: ${lastRun.id}`);
        console.log(`Status: ${lastRun.status}`);
        console.log(`Actor ID: ${lastRun.actId}`);
        console.log(`Started: ${lastRun.startedAt}`);
        console.log(`Finished: ${lastRun.finishedAt}`);
        console.log(`Dataset ID: ${lastRun.defaultDatasetId}`);
        console.log('--------------------------------------------------');

        if (lastRun.status !== 'SUCCEEDED') {
            console.warn('⚠️  Warning: This run did not succeed, data might be incomplete or missing.');
        }

        // Fetch dataset items
        const dataset = await client.dataset(lastRun.defaultDatasetId).listItems({ limit: 1 });

        if (dataset.items.length === 0) {
            console.log('❌ This run has an EMPTY dataset (0 items).');
            console.log('This explains why nothing is in the sheet!');

            // Check logs for why it's empty
            console.log('Fetching run log tail...');
            const log = await client.run(lastRun.id).log();
            // log() returns a stream or string depending on options, let's use get()
            // wait, client.log(runId).get() is the pattern usually
            const logText = await client.run(lastRun.id).log().get();
            console.log('--- LOG TAIL ---');
            console.log(logText.substring(logText.length - 1000));
            return;
        }

        const firstItem = dataset.items[0];
        console.log('✅ Found items!');
        console.log('First item keys:', Object.keys(firstItem));
        console.log('\n--- FIRST ITEM FULL DATA ---');
        console.log(JSON.stringify(firstItem, null, 2));
        console.log('----------------------------');

        // Critical Check for URL
        const url = firstItem.url || firstItem.productUrl || firstItem.product_url || firstItem.canonicalUrl;
        if (!url) {
            console.error('❌ CRITICAL: No recognizable URL field found!');
        } else {
            console.log(`✅ URL Field found: ${url}`);
        }

    } catch (error) {
        console.error('Error inspecting run:', error);
    }
}

inspectLastRun();
