
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

async function checkLatestRuns() {
    try {
        const runs = await client.actor(process.env.APIFY_ACTOR_ID).runs().list({ limit: 10, desc: true });
        console.log('Latest 10 Runs:');
        for (const run of runs.items) {
            // Fetch full run object to get stats
            const runDetail = await client.run(run.id).get();
            console.log(`- ID: ${runDetail.id}, Status: ${runDetail.status}, Items: ${runDetail.stats?.itemCount || 0}, Finished: ${runDetail.finishedAt}`);
        }

        const latestSuccessful = runs.items.find(r => r.status === 'SUCCEEDED');
        if (latestSuccessful) {
            console.log(`\nInspecting run: ${latestSuccessful.id}`);
            const dataset = await client.run(latestSuccessful.id).dataset();
            const { items } = await dataset.listItems({ limit: 1 });
            console.log('Sample Data Structure:', JSON.stringify(items[0], null, 2));
        }
    } catch (e) {
        console.error(e);
    }
}

checkLatestRuns();
