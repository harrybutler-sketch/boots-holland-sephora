import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const client = new ApifyClient({ token: APIFY_TOKEN });

async function checkTestRun() {
    const runId = 'jDCvsqKMgr8i0Wvmx';
    console.log(`Checking run ${runId}...`);
    
    const run = await client.run(runId).get();
    console.log(`Status: ${run.status}`);
    console.log(`Item count: ${run.stats?.itemCount || 0}`);
    
    if (run.stats?.itemCount > 0) {
        const dataset = await client.dataset(run.defaultDatasetId).listItems({ limit: 10 });
        console.log('Sample items:');
        dataset.items.forEach(item => {
            console.log(`- ${item.name || item.title} (${item.url})`);
        });
    }
}

checkTestRun().catch(console.error);
