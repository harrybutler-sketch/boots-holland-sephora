
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

async function checkGoodRunInput() {
    try {
        const goodRunId = 'H2o74fq6P0z41wKwn';
        const run = await client.run(goodRunId).get();
        const input = await client.keyValueStore(run.defaultKeyValueStoreId).getRecord('INPUT');

        console.log('--- GOOD RUN INPUT CONFIG ---');
        console.log('scrapeMode:', input.value.scrapeMode);
        console.log('proxyConfiguration:', JSON.stringify(input.value.proxyConfiguration, null, 2));
    } catch (error) {
        console.error('Error:', error);
    }
}

checkGoodRunInput();
