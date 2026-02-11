
import { ApifyClient } from 'apify-client';

export default async (req, context) => {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
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


        // Calculate date 4 weeks ago
        const date = new Date();
        date.setDate(date.getDate() - 28);
        const minDate = date.toISOString().split('T')[0];

        // Start the actor
        const run = await client.actor('harvestapi/linkedin-post-search').call({
            searchQueries: searchQueries,
            maxPosts: 50, // Limit to 50 posts for now to save credits/time
            minDate: minDate,
            sortBy: 'date'
        });

        return new Response(JSON.stringify({
            runId: run.id,
            status: run.status,
            message: 'LinkedIn Scrape Started'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error running LinkedIn scrape:', error);
        return new Response(JSON.stringify({ error: 'Failed to start LinkedIn scrape', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
