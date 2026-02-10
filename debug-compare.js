
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

async function compareRuns() {
    try {
        const goodRunId = 'H2o74fq6P0z41wKwn'; // From user screenshot

        console.log(`--- ANALYZING SUCCEEDED RUN: ${goodRunId} ---`);
        const goodRun = await client.run(goodRunId).get();
        const goodInput = await client.keyValueStore(goodRun.defaultKeyValueStoreId).getRecord('INPUT');
        console.log('Start URLs used:', JSON.stringify(goodInput.value.startUrls || goodInput.value.listingUrls, null, 2));

        console.log('\n--- ANALYZING LATEST (FAILED) RUN ---');
        const runs = await client.runs().list({ limit: 1, desc: true });
        const badRun = runs.items[0];
        console.log(`Run ID: ${badRun.id}`);

        const badLog = await client.log(badRun.id).get();
        const relevantLines = badLog.split('\n').filter(line =>
            line.includes('URL') ||
            line.includes('Sainsbury') ||
            line.includes('WARN') ||
            line.includes('ERROR')
        );
        console.log('Latest Log Snippet:\n', relevantLines.join('\n'));

        const badInput = await client.keyValueStore(badRun.defaultKeyValueStoreId).getRecord('INPUT');
        console.log('Latest Start URLs:', JSON.stringify(badInput.value.startUrls || badInput.value.listingUrls, null, 2));


    } catch (error) {
        console.error('Error:', error);
    }
}

compareRuns();
