import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const client = new ApifyClient({ token: APIFY_TOKEN });

async function checkRunLog() {
    const runId = '6ktY1LtRkjWp8h5TF';
    console.log(`Checking log for run ${runId}...`);
    
    const log = await client.log(runId).get();
    if (log) {
        const lines = log.split('\n');
        const asdaLines = lines.filter(l => l.includes('asda') || l.includes('Asda'));
        console.log(`Found ${asdaLines.length} log lines mentioning Asda.`);
        console.log('Sample Asda log lines:');
        console.log(asdaLines.slice(-30).join('\n'));
        
        const errors = lines.filter(l => l.includes('ERROR') || l.includes('Timeout') || l.includes('failed'));
        console.log('\nGeneral Errors:');
        console.log(errors.slice(-20).join('\n'));
    }
}

checkRunLog().catch(console.error);
