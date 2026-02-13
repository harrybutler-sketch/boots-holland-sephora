
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

async function listRuns() {
    const client = new ApifyClient({
        token: process.env.APIFY_TOKEN,
    });

    const actorId = process.env.APIFY_ACTOR_ID;

    console.log(`Fetching runs for Actor ID: ${actorId || 'Global'}`);

    const runs = await client.runs().list({
        desc: true,
        limit: 5,
    });

    console.log("--- Recent Runs ---");
    runs.items.forEach(run => {
        console.log(`ID: ${run.id} | Status: ${run.status} | Created: ${run.startedAt} | Finished: ${run.finishedAt}`);
    });
}

listRuns();
