
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

async function checkLatestRuns() {
    try {
        const fs = await import('fs');
        let output = 'Latest 10 Runs:\n';
        const runs = await client.actor(process.env.APIFY_ACTOR_ID).runs().list({ limit: 10, desc: true });

        for (const run of runs.items) {
            const runDetail = await client.run(run.id).get();
            output += `- ID: ${runDetail.id}, Status: ${runDetail.status}, Items: ${runDetail.stats?.itemCount || 0}, Finished: ${runDetail.finishedAt}\n`;
        }

        const latestSuccessful = runs.items.find(r => r.status === 'SUCCEEDED');
        if (latestSuccessful) {
            console.log(`\nInspecting run: ${latestSuccessful.id}`);
            const dataset = await client.run(latestSuccessful.id).dataset();
            const { items } = await dataset.listItems({ limit: 1 });
            await fs.promises.writeFile('sample_item.json', JSON.stringify(items[0], null, 2));
            console.log('Sample item written to sample_item.json');
        }

        await fs.promises.writeFile('recent_runs.txt', output);
        console.log('Written to recent_runs.txt');
    } catch (e) {
        console.error(e);
    }
}

checkLatestRuns();
