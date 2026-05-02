import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

async function checkItems() {
    const run = await client.run('9nu5mX6q0ihaTsV0R').get();
    const dataset = await client.dataset(run.defaultDatasetId).get();
    console.log(`Run status: ${run.status}, Item count: ${dataset.itemCount}`);
    if (dataset.itemCount > 0) {
        const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 1 });
        console.log(items[0]);
    }
}
checkItems().catch(console.error);
