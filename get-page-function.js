import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const client = new ApifyClient({ token: APIFY_TOKEN });

async function getPageFunction() {
    const runId = '6ktY1LtRkjWp8h5TF';
    const run = await client.run(runId).get();
    const inputRecord = await client.keyValueStore(run.defaultKeyValueStoreId).getRecord('INPUT');
    if (inputRecord && inputRecord.value) {
        console.log('--- PAGE FUNCTION ---');
        console.log(inputRecord.value.pageFunction);
    }
}

getPageFunction().catch(console.error);
