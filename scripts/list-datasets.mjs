import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

async function listDatasets() {
    console.log('Listing recent datasets...');
    const datasets = await client.datasets().list({
        limit: 50,
        desc: true
    });
    datasets.items.forEach(dataset => {
        console.log(`ID: ${dataset.id} | Name: ${dataset.name} | Created: ${dataset.createdAt} | Items: ${dataset.itemCount}`);
    });
}

listDatasets();
