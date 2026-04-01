import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
const datasetId = process.argv[2];

async function listItems() {
    if (!datasetId) {
        console.error('Usage: node list-items.mjs <datasetId>');
        process.exit(1);
    }
    const dataset = await client.dataset(datasetId).listItems();
    console.log(`Fetched ${dataset.items.length} items.`);
    dataset.items.forEach((item, index) => {
        console.log(`[${index}] ${item.retailer} - ${item.name} (${item.reviews} reviews) - ${item.url}`);
        if (item.status) console.log(`    Status: ${item.status}`);
        if (item.isOwnBrand) console.log(`    isOwnBrand: ${item.isOwnBrand}`);
    });
}

listItems();
