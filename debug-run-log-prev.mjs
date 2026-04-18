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
    const runId = 'W94rLj4a2oDwKgXQ0';
    try {
        console.log(`Fetching log for run ${runId}...`);
        const log = await client.run(runId).log().get();
        fs.writeFileSync('run_log_prev.txt', log);
        console.log('Log written to run_log_prev.txt');
        
        const lines = log.split('\n');
        console.log('Log snippet:');
        console.log(lines.filter(l => l.includes('Scraping listing')).join('\n'));
    } catch (e) {
        console.error(e);
    }
}

checkLog();
