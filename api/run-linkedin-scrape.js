
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

        // Symmetrical search patterns for all retailers
        const searchQueries = [
            ...retailers.flatMap(retailer => [
                `launched in ${retailer}`,
                `new listing at ${retailer}`,
                `now available at ${retailer}`,
                `listed in ${retailer}`,
                `launching in ${retailer}`,
                `hitting ${retailer} shelves`
            ]),
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
            maxPosts: 150, // Increased to capture more results
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
