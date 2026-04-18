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
    const runId = 'GOk3G3PcZuZv0Rtgw';
    try {
        console.log(`Fetching log for run ${runId}...`);
        const log = await client.run(runId).log().get();
        fs.writeFileSync('run_log_beauty.txt', log);
        console.log('Log written to run_log_beauty.txt');
        
        // Check for specific keywords in the log
        const lines = log.split('\n');
        const interestingLines = lines.filter(l => 
            l.includes('Skipping') || 
            l.includes('Found') || 
            l.includes('Exception') || 
            l.includes('DETAIL') ||
            l.includes('LISTING')
        );
        console.log('\nInteresting Log Snippets:');
        console.log(interestingLines.slice(-20).join('\n'));
    } catch (e) {
        console.error(e);
    }
}

checkLog();
