import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const client = new ApifyClient({ token: APIFY_TOKEN });

async function getRunInput() {
    const runId = '6ktY1LtRkjWp8h5TF';
    console.log(`Getting input for run ${runId}...`);
    
    const run = await client.run(runId).get();
    const inputRecord = await client.keyValueStore(run.defaultKeyValueStoreId).getRecord('INPUT');
    if (inputRecord && inputRecord.value) {
        console.log('Run Input:', JSON.stringify(inputRecord.value, null, 2));
    } else {
        console.log('No input record found.');
    }
}

getRunInput().catch(console.error);
