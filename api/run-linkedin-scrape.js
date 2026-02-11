
import { ApifyClient } from 'apify-client';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).send('Method Not Allowed');
    }

    try {
        const client = new ApifyClient({
            token: process.env.APIFY_TOKEN,
        });

        // Search Queries for "New Launches"
        const searchQueries = [
            'launched in Tesco',
            'launched in Sainsbury\'s',
            'launched in Asda',
            'launched in Morrisons',
            'launched in Waitrose',
            'launched in Ocado',
            'launched in Boots',
            'launched in Superdrug',
            'launched in Sephora',
            'launched in Holland & Barrett',
            'new listing at Tesco',
            'new listing at Sainsbury\'s',
            'new listing at Boots',
            'now available at Tesco',
            'now available at Boots'
        ];

        // Start the actor
        const run = await client.actor('harvestapi/linkedin-post-search-scraper').call({
            searchQueries: searchQueries,
            maxPosts: 50, // Limit to 50 posts for now to save credits/time
            minDate: '2024-01-01', // Should ideally be dynamic (e.g. last 30 days)
            sortBy: 'date_posted'
        });

        return response.status(200).json({
            runId: run.id,
            status: run.status,
            message: 'LinkedIn Scrape Started'
        });

    } catch (error) {
        console.error('Error running LinkedIn scrape:', error);
        return response.status(500).json({ error: 'Failed to start LinkedIn scrape' });
    }
}
