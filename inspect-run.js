import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

async function inspect() {
    const runId = 'iEJH0YMj7BvLjnEn5';
    console.log(`Inspecting run ${runId}...`);
    const { items } = await client.run(runId).dataset().listItems();
    console.log(`Found ${items.length} items`);
    if (items.length > 0) {
       console.log(JSON.stringify(items.slice(0, 5), null, 2));
    }
}

inspect();
