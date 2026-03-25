import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

async function getMorrisonsData() {
    try {
        // Find the most recent Morrisons run by fetching the last 10 runs
        const runsList = await client.actor('apify/puppeteer-scraper').runs().list({ limit: 10, desc: true });
        
        for (const runData of runsList.items) {
            console.log(`Checking Run ${runData.id} - Status: ${runData.status} - Started: ${runData.startedAt}`);
            const dataset = await client.dataset(runData.defaultDatasetId).listItems();
            
            const morrisonsItems = dataset.items.filter(i => (i.retailer || '').includes('Morrisons') || (i.url || '').includes('morrisons'));
            
            if (morrisonsItems.length > 0) {
                console.log(`\n\n=== FOUND MORRISONS RUN ${runData.id} ===`);
                console.log(`Dataset has ${dataset.items.length} total items. Morrisons items: ${morrisonsItems.length}`);
                console.log('Sample Morrisons Items:');
                console.log(JSON.stringify(morrisonsItems.slice(0, 3), null, 2));
                return;
            }
        }
        console.log('No recent runs contained Morrisons data.');
    } catch (e) {
        console.error('Error fetching dataset:', e);
    }
}

getMorrisonsData();
