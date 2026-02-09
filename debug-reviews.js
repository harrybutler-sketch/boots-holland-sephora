
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

async function debugReviews() {
    const runId = 'Dfn0Dr6NqkJC9fkaE';
    console.log(`Checking run: ${runId}`);

    try {
        const dataset = await client.run(runId).dataset();
        const { items } = await dataset.listItems();

        const target = items.find(i => i.name && i.name.includes('Sleep Support Powder'));
        if (target) {
            console.log('Target Product Found:', target.name);
            console.log('FULL DATA:', JSON.stringify(target, null, 2));
        } else {
            console.log('Product not found in dataset');
        }
    } catch (e) {
        console.error('Error fetching Apify data:', e);
    }
}

debugReviews();
