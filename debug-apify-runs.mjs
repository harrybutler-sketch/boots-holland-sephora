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

async function checkLatestRuns() {
    try {
        console.log('Fetching latest 10 runs for apify/puppeteer-scraper...');
        const runs = await client.actor('apify/puppeteer-scraper').runs().list({ limit: 10, desc: true });

        for (const run of runs.items) {
            console.log(`- ID: ${run.id}, Status: ${run.status}, Items: ${run.stats?.itemCount || 0}, Started: ${run.startedAt}`);
        }

        const latestSuccess = runs.items.find(r => r.status === 'SUCCEEDED' && r.stats?.itemCount > 0);
        if (latestSuccess) {
            console.log(`\nInspecting successful items for run: ${latestSuccess.id}`);
            const dataset = await client.dataset(latestSuccess.defaultDatasetId);
            const { items } = await dataset.listItems({ limit: 5 });
            console.log('Sample Items:', JSON.stringify(items, null, 2));
        }
    } catch (e) {
        console.error(e);
    }
}

checkLatestRuns();
