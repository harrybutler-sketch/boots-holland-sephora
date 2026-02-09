
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

async function deepSearchReviews() {
    const runId = 'Dfn0Dr6NqkJC9fkaE';
    try {
        const dataset = await client.run(runId).dataset();
        const { items } = await dataset.listItems();

        const allKeys = new Set();
        items.forEach(item => {
            Object.keys(item).forEach(key => allKeys.add(key));
            if (item.attributes) Object.keys(item.attributes).forEach(key => allKeys.add(`attr:${key}`));
            if (item.aggregateRating) Object.keys(item.aggregateRating).forEach(key => allKeys.add(`rating:${key}`));
        });

        console.log('Available Keys:', Array.from(allKeys).filter(k =>
            k.toLowerCase().includes('review') ||
            k.toLowerCase().includes('rating') ||
            k.toLowerCase().includes('star') ||
            k.toLowerCase().includes('count')
        ));

        const target = items.find(i => i.name && i.name.includes('Sleep Support Powder'));
        console.log('Target item keys:', Object.keys(target));

    } catch (e) {
        console.error(e);
    }
}

deepSearchReviews();
