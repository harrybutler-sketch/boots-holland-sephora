import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const client = new ApifyClient({ token: APIFY_TOKEN });

async function checkRunLog() {
    const runId = 'jDCvsqKMgr8i0Wvmx';
    console.log(`Checking log for run ${runId}...`);
    
    const log = await client.log(runId).get();
    if (log) {
        console.log('--- LOG START (LAST 50 LINES) ---');
        const lines = log.split('\n');
        console.log(lines.slice(-50).join('\n'));
    }
}

checkRunLog().catch(console.error);
