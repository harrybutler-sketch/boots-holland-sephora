
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

async function inspect() {
    const runId = 'GEBsPcIfpYSanK758';
    console.log(`Inspecting run ${runId}...`);
    const { items } = await client.run(runId).dataset().listItems({ limit: 5 });
    console.log(JSON.stringify(items, null, 2));
}

inspect();
