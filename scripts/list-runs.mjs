import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

async function listRuns() {
    const actorId = 'apify/puppeteer-scraper';
    console.log(`Listing runs for actor: ${actorId}`);

    const runs = await client.actor(actorId).runs().list({
        limit: 50,
        desc: true
    });

    console.log('Recent Runs:');
    runs.items.forEach(run => {
        const count = run.stats?.itemCount ?? 'N/A';
        console.log(`ID: ${run.id} | Status: ${run.status} | Items: ${count} | Started: ${run.startedAt}`);
    });
}

listRuns();
