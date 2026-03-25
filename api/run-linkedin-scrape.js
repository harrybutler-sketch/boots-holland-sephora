
import { ApifyClient } from 'apify-client';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const { mode } = req.body || {};
        const client = new ApifyClient({
            token: process.env.APIFY_TOKEN,
        });

        // Retailers to monitor for mentions
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

        // Targeted Grocer/Industry LinkedIn Pages
        const targetUrls = [
            'https://www.linkedin.com/company/thegrocer/posts/?feedView=all',
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

        let config = {};

        const SEARCH_QUERIES = (mode === 'grocer-pages') 
            ? [
                "new product", "launch", "listing", "available now", "shelf", "shelves",
                "hitting shelves", "now in stock", "new brand", "exclusive", "range",
                "introducing", "latest launch"
            ]
            : retailers.flatMap(retailer => [
                `new product launch at ${retailer}`,
                `exclusive listing at ${retailer}`,
                `brand new range at ${retailer}`,
                `now on shelf at ${retailer}`,
                `new flavor launch at ${retailer}`,
                `new SKU at ${retailer}`
            ]);

        // USER REQUEST: Ensure we don't exceed 1000 items TOTAL across all queries
        const totalLimit = 1000;
        const maxPostsPerQuery = Math.max(1, Math.floor(totalLimit / SEARCH_QUERIES.length));

        if (mode === 'grocer-pages') {
            config = {
                searchQueries: SEARCH_QUERIES,
                targetUrls: targetUrls,
                maxPosts: maxPostsPerQuery
            };
        } else {
            config = {
                searchQueries: SEARCH_QUERIES,
                maxPosts: maxPostsPerQuery
            };
        }


        // Calculate date 4 weeks ago
        const date = new Date();
        date.setDate(date.getDate() - 28);
        const minDate = date.toISOString().split('T')[0];

        // Start the actor
        const run = await client.actor('harvestapi/linkedin-post-search').call({
            ...config,
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
