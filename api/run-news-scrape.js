import { ApifyClient } from 'apify-client';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const client = new ApifyClient({
            token: process.env.APIFY_TOKEN,
        });

        const publishers = [
            'site:thegrocer.co.uk',
            'site:retailgazette.co.uk',
            'site:talkingretail.com',
            'site:conveniencestore.co.uk',
            'site:kamcity.com'
        ];

        const launchTerms = [
            '"launched"',
            '"unveiled"',
            '"rolled out"',
            '"exclusive to"'
        ];

        const retailers = [
            'Tesco', 'Sainsburys', 'Asda', 'Morrisons', 'Waitrose', 'Ocado', 'Boots', 'Superdrug', 'Sephora', 'Holland & Barrett'
        ];

        let queries = [];
        for (const pub of publishers) {
            // Generic publisher launch search
            for (const term of launchTerms) {
                queries.push(`${pub} ${term}`);
            }
            // Retailer specific news on these sites
            for (const retailer of retailers) {
                queries.push(`${pub} "${retailer}" "new product"`);
                queries.push(`${pub} "${retailer}" "launch"`);
                queries.push(`${pub} "${retailer}" "listing"`);
            }
        }

        // Shuffle and take top 30 queries (Google Scraper can handle it)
        const selectedQueries = queries
            .sort(() => 0.5 - Math.random())
            .slice(0, 30)
            .join('\n');

        // Start the Apify Google Search Scraper actor
        const run = await client.actor('apify/google-search-scraper').call({
            queries: selectedQueries,
            maxPagesPerQuery: 1,
            resultsPerPage: 10,
            csvFriendlyOutput: false,
            // To get recent news, we could add a date parameter like &tbs=qdr:m for last month, but apify has custom params:
            customParameters: "tbs=qdr:m", // Last month only
        });

        return res.status(200).json({
            runId: run.id,
            status: run.status,
            message: 'News Scrape Started'
        });

    } catch (error) {
        console.error('Error running News scrape:', error);
        return res.status(500).json({ error: 'Failed to start News scrape', details: error.message });
    }
}
