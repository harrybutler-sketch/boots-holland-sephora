import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

async function checkRunLogs() {
    const runId = 'hssdYHeReOlbmxb3x';
    const log = await client.log(runId).get();
    console.log(log);
}

checkRunLogs();
