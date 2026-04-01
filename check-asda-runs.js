import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const client = new ApifyClient({ token: APIFY_TOKEN });

async function checkAsdaRuns() {
    console.log('Checking recent runs for apify/puppeteer-scraper...');
    const runs = await client.actor('apify/puppeteer-scraper').runs().list({ limit: 20, desc: true });
    
    for (const runSummary of runs.items) {
        const run = await client.run(runSummary.id).get();
        // Get the input to check if it was an Asda run
        const inputRecord = await client.keyValueStore(run.defaultKeyValueStoreId).getRecord('INPUT');
        const input = inputRecord ? inputRecord.value : null;
        if (input && input.startUrls && input.startUrls.some(u => u.url.includes('asda.com'))) {
            console.log(`\nRun ID: ${run.id}`);
            console.log(`Status: ${run.status}`);
            console.log(`Items: ${run.stats ? run.stats.itemCount : 'N/A'}`);
            console.log(`Started: ${run.startedAt}`);
            console.log(`Finished: ${run.finishedAt}`);
            
            if (run.stats.itemCount > 0) {
                const dataset = await client.run(run.id).dataset();
                const { items } = await dataset.listItems({ limit: 5 });
                console.log('Sample item names:', items.map(i => i.name));
            }
            
            if (run.status !== 'SUCCEEDED') {
                console.log('Checking log for failures...');
                const log = await client.log(run.id).get();
                if (log) {
                    const lines = log.split('\n');
                    const errorLines = lines.filter(l => l.includes('ERROR') || l.includes('warning') || l.includes('timeout'));
                    console.log('Error/Warning snippets from log:');
                    console.log(errorLines.slice(-10).join('\n'));
                }
            }
        }
    }
}

checkAsdaRuns().catch(console.error);
