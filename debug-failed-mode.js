
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

async function checkMode() {
    try {
        const runId = '8f9fd0W2QJdle1Bgz';
        console.log(`Checking Run: ${runId}`);

        const inputRecord = await client.keyValueStore((await client.run(runId).get()).defaultKeyValueStoreId).getRecord('INPUT');
        console.log('scrapeMode:', inputRecord.value.scrapeMode);
        console.log('URLs:', JSON.stringify(inputRecord.value.listingUrls || inputRecord.value.startUrls, null, 2));

    } catch (error) {
        console.error('Error:', error);
    }
}

checkMode();
