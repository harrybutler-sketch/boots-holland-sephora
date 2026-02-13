import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const runId = 'q4nV7RjJzdKk2xKOo';

async function inspect() {
    const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
    const run = await client.run(runId).get();
    const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 1 });
    console.dir(items[0], { depth: null });
}

inspect();
