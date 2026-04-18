import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN
});

async function listRecent() {
    console.log('Listing last 20 runs...');
    const runs = await client.runs().list({ limit: 20, desc: true });
    runs.items.forEach(r => {
        console.log(`- ID: ${r.id}, Started: ${r.startedAt}, Status: ${r.status}`);
    });
}

listRecent().catch(console.error);
