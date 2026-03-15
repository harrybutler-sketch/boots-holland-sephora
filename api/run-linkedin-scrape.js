
import { ApifyClient } from 'apify-client';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const client = new ApifyClient({
            token: process.env.APIFY_TOKEN,
        });

        // Retailers to monitor
        const retailers = [
            'Tesco',
            'Sainsbury\'s',
            'Asda',
            'Morrisons',
            'Waitrose',
            'Ocado',
            'Boots',
            'Superdrug',
            'Sephora',
            'Holland & Barrett'
        ];

        // Symmetrical search patterns for all retailers
        const searchQueries = retailers.flatMap(retailer => [
            `launched in ${retailer}`,
            `new listing at ${retailer}`,
            `now available at ${retailer}`,
            `listed in ${retailer}`,
            `launching in ${retailer}`,
            `hitting ${retailer} shelves`
        ]);


        // Calculate date 4 weeks ago
        const date = new Date();
        date.setDate(date.getDate() - 28);
        const minDate = date.toISOString().split('T')[0];

        // Start the actor
        const run = await client.actor('harvestapi/linkedin-post-search').call({
            searchQueries: searchQueries,
            maxPosts: 100, // Increased to 100 to capture more results across all queries
            minDate: minDate,
            sortBy: 'date'
        });

        return res.status(200).json({
            runId: run.id,
            status: run.status,
            message: 'LinkedIn Scrape Started'
        });

    } catch (error) {
        console.error('Error running LinkedIn scrape:', error);
        return res.status(500).json({ error: 'Failed to start LinkedIn scrape', details: error.message });
    }
}
