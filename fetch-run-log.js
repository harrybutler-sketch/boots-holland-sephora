
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

async function fetchRunLog() {
    try {
        const runId = '13kwLQqZjbSHxzjJo';
        console.log(`Fetching log for run: ${runId}`);
        const log = await client.run(runId).log().get();
        console.log(log);
    } catch (e) {
        console.error(e);
    }
}

fetchRunLog();
