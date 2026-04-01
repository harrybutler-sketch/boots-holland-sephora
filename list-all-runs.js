import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const client = new ApifyClient({ token: APIFY_TOKEN });

async function listAllRecentRuns() {
    console.log('Listing all recent runs (last 50)...');
    const runs = await client.runs().list({ limit: 50, desc: true });
    
    for (const run of runs.items) {
        console.log(`\nID: ${run.id} | Actor: ${run.actId} | Status: ${run.status} | Started: ${run.startedAt}`);
        
        // Try to get input for potential Asda runs
        if (run.status === 'SUCCEEDED' || run.status === 'RUNNING' || run.status === 'FAILED') {
             try {
                const inputRecord = await client.keyValueStore(run.defaultKeyValueStoreId).getRecord('INPUT');
                if (inputRecord && inputRecord.value) {
                    const url = inputRecord.value.startUrls ? inputRecord.value.startUrls[0].url : (inputRecord.value.url || '');
                    console.log(`URL: ${url}`);
                }
             } catch (e) {}
        }
    }
}

listAllRecentRuns().catch(console.error);
