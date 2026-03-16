
import { ApifyClient } from 'apify-client';

export default async (req, context) => {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const client = new ApifyClient({
            token: process.env.APIFY_TOKEN,
        });

        // Targeted Grocer LinkedIn Pages
        const targetUrls = [
            'https://www.linkedin.com/company/tesco/',
            'https://www.linkedin.com/company/sainsbury\'s/',
            'https://www.linkedin.com/company/asda/',
            'https://www.linkedin.com/company/morrisons/',
            'https://www.linkedin.com/company/johnlewisandpartners/', // Waitrose
            'https://www.linkedin.com/company/ocadogroup/',
            'https://www.linkedin.com/company/boots/',
            'https://www.linkedin.com/company/superdrug/',
            'https://www.linkedin.com/company/sephora/',
            'https://www.linkedin.com/company/holland-&-barrett/'
        ];

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
            'now available at Boots',
            // General product launch queries for the target pages
            "new product launch",
            "exclusive launch",
            "new brand alert",
            "now in stock",
            "excited to share our new",
            "introducing our latest"
        ];


        // Calculate date 4 weeks ago
        const date = new Date();
        date.setDate(date.getDate() - 28);
        const minDate = date.toISOString().split('T')[0];

        // Start the actor
        const run = await client.actor('harvestapi/linkedin-post-search').call({
            searchQueries: searchQueries,
            targetUrls: targetUrls, // Monitor these specific grocer pages
            maxPosts: 100, // Increased to capture more results
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
