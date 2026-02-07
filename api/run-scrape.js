const { ApifyClient } = require('apify-client');

export default async function handler(request, response) {
    // Only allow POST
    if (request.method !== 'POST') {
        return response.status(405).send('Method Not Allowed');
    }

    try {
        let { retailers, mode } = request.body || {};

        // Handle case where body is a string (e.g. missing header)
        if (typeof request.body === 'string') {
            try {
                const parsed = JSON.parse(request.body);
                retailers = parsed.retailers;
                mode = parsed.mode;
            } catch (e) {
                console.error('Failed to parse body:', e);
            }
        }

        if (!retailers || !Array.isArray(retailers) || retailers.length === 0) {
            return response.status(400).json({ error: 'Retailers list is required' });
        }

        const client = new ApifyClient({
            token: process.env.APIFY_TOKEN,
        });

        // Configure input for the Apify Actor
        const startUrls = [];

        if (retailers.includes('Sephora')) {
            startUrls.push({
                url: 'https://www.sephora.co.uk/new-at-sephora?srsltid=AfmBOookMPw5VCcz6Fai1EHtuFe6ajRPCD-ySREKZS6gnvu2ECZBITWv&filter=fh_location=//c1/en_GB/in_stock%3E{in}/new_in=1/!exclude_countries%3E{gb}/!site_exclude%3E{79}/!brand=a70/%26device=desktop%26site_area=cms%26date_time=20260207T101506%26fh_view_size=40%26fh_start_index=0%26fh_view_size=120',
                userData: { retailer: 'Sephora' },
            });
        }
        if (retailers.includes('Boots')) {
            startUrls.push({
                url: 'https://www.boots.com/new-to-boots',
                userData: { retailer: 'Boots' },
            });
        }
        if (retailers.includes('Holland & Barrett')) {
            startUrls.push({
                url: 'https://www.hollandandbarrett.com/shop/health-wellness/?t=is_new%3Atrue',
                userData: { retailer: 'Holland & Barrett' },
            });
            startUrls.push({
                url: 'https://www.hollandandbarrett.com/shop/natural-beauty/natural-beauty-shop-all/?t=is_new%3Atrue',
                userData: { retailer: 'Holland & Barrett' },
            });
        }

        // Call the actor
        const run = await client.actor(process.env.APIFY_ACTOR_ID).start({
            listingUrls: startUrls,
            scrapeMode: 'AUTO',
            // Dynamic limit: 25 per retailer (e.g., 3 retailers = 75 items)
            maxProductResults: retailers.length * 25,
            proxyConfiguration: {
                useApifyProxy: true
            }
        });

        return response.status(200).json({
            runId: run.id,
            statusUrl: run.statusUrl,
            startedAt: run.startedAt,
        });

    } catch (error) {
        console.error('Error triggering scrape:', error);
        return response.status(500).json({ error: `Failed to trigger scrape: ${error.message}` });
    }
}
