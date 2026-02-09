
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

async function compareReviews() {
    const runId = 'OWnAbVHgDs9IDSTb0';
    try {
        const dataset = await client.run(runId).dataset();
        const { items } = await dataset.listItems();

        console.log(`Total items: ${items.length}`);

        const hbItems = items.filter(i => i.url && i.url.includes('hollandandbarrett'));
        const sephoraItems = items.filter(i => i.url && i.url.includes('sephora'));

        const getReviews = (i) => i.reviewCount || i.reviewsCount || i.reviews_count || i.rating_count ||
            (i.reviews && (i.reviews.total || i.reviews.count)) ||
            (i.aggregateRating && i.aggregateRating.reviewCount) || 0;

        const hbWithReviews = hbItems.filter(i => getReviews(i) > 0);
        const sephoraWithReviews = sephoraItems.filter(i => getReviews(i) > 0);

        console.log(`H&B: ${hbItems.length} items, ${hbWithReviews.length} with reviews`);
        console.log(`Sephora: ${sephoraItems.length} items, ${sephoraWithReviews.length} with reviews`);

        if (sephoraWithReviews.length > 0) {
            console.log('Sample Sephora with Reviews:', JSON.stringify(sephoraWithReviews[0], null, 2));
        }

    } catch (e) {
        console.error(e);
    }
}

compareReviews();
