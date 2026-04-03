import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();
const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
const datasetId = 'whESLLAGBT4xtbb5b';
try {
    const { items } = await client.dataset(datasetId).listItems();
    console.log('Total Items:', items.length);
    items.slice(0, 10).forEach(i => console.log('Item:', i.name || 'No Name', i.url));
} catch (e) {
    console.error(e);
}
