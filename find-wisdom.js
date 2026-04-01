import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const client = new ApifyClient({ token: APIFY_TOKEN });

async function findWisdomInLog() {
    const runId = '6ktY1LtRkjWp8h5TF';
    console.log(`Searching log for "Wisdom" in run ${runId}...`);
    
    const log = await client.log(runId).get();
    if (log) {
        const lines = log.split('\n');
        const wisdomLines = lines.filter(l => l.toLowerCase().includes('wisdom'));
        console.log(`Found ${wisdomLines.length} lines.`);
        if (wisdomLines.length > 0) {
            console.log('Sample Wisdom log lines:');
            console.log(wisdomLines.slice(0, 10).join('\n'));
        }
    }
}

findWisdomInLog().catch(console.error);
