import { ApifyClient } from 'apify-client';
import fs from 'fs';
import path from 'path';

const envMap = {};
try {
    const envFile = fs.readFileSync(path.resolve('.env'), 'utf8');
    envFile.split('\n').filter(Boolean).forEach(line => {
        const idx = line.indexOf('=');
        if (idx > -1) {
            envMap[line.substring(0, idx)] = line.substring(idx + 1).replace(/^"|"$/g, '').replace(/^'|'$/g, '');
        }
    });
} catch(e) {}

const client = new ApifyClient({
    token: envMap.APIFY_TOKEN,
});

async function checkRunStatus() {
    const runId = 'ltPZXQxQwY9hu6ROm';
    try {
        const run = await client.run(runId).get();
        console.log(`Run ${runId} Status: ${run.status}, Items: ${run.stats?.itemCount || 0}`);
        
        if (run.status === 'SUCCEEDED') {
            console.log('Run Succeeded! Checking dataset...');
            const dataset = await client.dataset(run.defaultDatasetId).listItems({ limit: 5 });
            console.log('Sample Items:', JSON.stringify(dataset.items, null, 2));
        }
    } catch (e) {
        console.error(e);
    }
}

checkRunStatus();
