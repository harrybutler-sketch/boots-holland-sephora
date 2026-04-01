import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

async function checkRecentLinkedinScrape() {
    console.log('--- Checking Recent LinkedIn Scrapes ---');
    try {
        const actorId = 'harvestapi/linkedin-post-search';
        const newsActorId = 'apify/google-search-scraper';

        console.log(`\nActor: ${actorId}`);
        const linkedinRuns = await client.actor(actorId).runs().list({ limit: 3, desc: true });
        linkedinRuns.items.forEach(run => {
            console.log(`Run ID: ${run.id} | Status: ${run.status} | Created: ${run.createdAt} | Items: ${run.itemCount}`);
        });

        console.log(`\nActor: ${newsActorId}`);
        const newsRuns = await client.actor(newsActorId).runs().list({ limit: 3, desc: true });
        newsRuns.items.forEach(run => {
            console.log(`Run ID: ${run.id} | Status: ${run.status} | Created: ${run.createdAt} | Items: ${run.itemCount}`);
        });

    } catch (error) {
        console.error('Error fetching runs:', error.message);
    }
}

checkRecentLinkedinScrape();
