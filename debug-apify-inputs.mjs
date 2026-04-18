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
        const runs = await client.actor('apify/puppeteer-scraper').runs().list({ limit: 10, desc: true });

        for (const run of runs.items) {
            const input = await client.run(run.id).getInput();
            const urls = input.startUrls?.map(u => u.url).join(', ') || 'N/A';
            console.log(`- ID: ${run.id}, Status: ${run.status}, Items: ${run.stats?.itemCount || 0}, Started: ${run.startedAt}`);
            console.log(`  URLs: ${urls}`);
        }
    } catch (e) {
        console.error(e);
    }
}

checkLatestRuns();
