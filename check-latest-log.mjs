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

async function checkLog() {
    const runId = 'ltPZXQxQwY9hu6ROm';
    try {
        console.log(`Fetching log for run ${runId}...`);
        const log = await client.run(runId).log().get();
        const lines = log.split('\n');
        console.log('Last 20 lines:');
        console.log(lines.slice(-20).join('\n'));
    } catch (e) {
        console.error(e);
    }
}

checkLog();
