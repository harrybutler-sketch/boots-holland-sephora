import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

async function checkSainsburysLastSuccess() {
    console.log('Searching for successful Sainsbury\'s runs...');
    
    // Fetch recent runs of the most common scraper actors
    const actors = ['apify/puppeteer-scraper', 'apify/web-scraper'];
    
    for (const actorId of actors) {
        const runs = await client.actor(actorId).runs().list({ limit: 20, desc: true });
        
        for (const run of runs.items) {
            if (run.status === 'SUCCEEDED') {
                const dataset = await client.dataset(run.defaultDatasetId).listItems({ limit: 10 });
                const hasSainsburys = dataset.items.some(item => 
                    (item.retailer && item.retailer.toLowerCase().includes('sainsbury')) || 
                    (item.url && item.url.includes('sainsburys.co.uk'))
                );
                
                if (hasSainsburys) {
                    console.log(`Success found! Actor: ${actorId}, Run ID: ${run.id}, Date: ${run.finishedAt}`);
                    // Fetch full count
                    const fullDataset = await client.dataset(run.defaultDatasetId).get();
                    console.log(`Items in this run: ${fullDataset.itemCount}`);
                    return;
                }
            }
        }
    }
    console.log('No successful Sainsbury\'s runs found in the last 20 attempts.');
}

checkSainsburysLastSuccess().catch(console.error);
