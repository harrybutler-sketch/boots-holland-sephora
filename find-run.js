
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

async function findRun() {
    console.log('Searching for recent runs...');
    const runs = await client.runs().list({ limit: 20, desc: true });

    for (const run of runs.items) {
        console.log(`ID: ${run.id}, Actor: ${run.actId}, Status: ${run.status}, Items: ${run.stats?.itemCount}, Started: ${run.startedAt}`);
    }
}

findRun();
