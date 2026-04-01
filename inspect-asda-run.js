import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const client = new ApifyClient({ token: APIFY_TOKEN });

async function inspectAsdaRun() {
    const runId = '6ktY1LtRkjWp8h5TF';
    console.log(`Inspecting run ${runId}...`);
    
    const run = await client.run(runId).get();
    console.log('Run Object:', JSON.stringify(run, null, 2));
    
    if (run.defaultDatasetId) {
        console.log(`\nDataset ID: ${run.defaultDatasetId}`);
        const dataset = await client.dataset(run.defaultDatasetId).get();
        console.log('Dataset Object:', JSON.stringify(dataset, null, 2));
        
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        const asdaItems = items.filter(i => i.retailer === 'Asda' || (i.url && i.url.includes('asda.com')));
        console.log(`\nFound ${asdaItems.length} Asda items (out of ${items.length}):`);
        console.log(JSON.stringify(asdaItems.slice(0, 10), null, 2));
    }
}

inspectAsdaRun().catch(console.error);
