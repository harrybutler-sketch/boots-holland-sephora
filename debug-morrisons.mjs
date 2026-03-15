import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

async function getLatestRun() {
    const runsList = await client.actor('apify/puppeteer-scraper').runs().list({ limit: 1, desc: true });
    
    for (const runData of runsList.items) {
        console.log(`Run ${runData.id} - Status: ${runData.status} - Started: ${runData.startedAt}`);
        
        try {
            const logArrayBuffer = await client.run(runData.id).log().get();
            const log = Buffer.from(logArrayBuffer).toString('utf-8');
            
            console.log(`\n\n--- LOG FOR RUN ${runData.id} ---`);
            const lines = log.split('\n');
            const errors = lines.filter(l => l.includes('error') || l.includes('Error') || l.includes('failed') || l.includes('timeout') || l.includes('Timeout') || l.includes('Morrisons'));
            console.log(errors.slice(-40).join('\n'));
            
        } catch (e) {
            console.error('Error fetching log:', e.message);
        }
    }
}

getLatestRun();
