import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

export default async function handler(request, response) {
    // Only allow POST
    if (request.method !== 'POST') {
        return response.status(405).send('Method Not Allowed');
    }

    try {
        let { retailers, mode, workspace = 'beauty' } = request.body || {};

        // Handle case where body is a string (e.g. missing header)
        if (typeof request.body === 'string') {
            try {
                const parsed = JSON.parse(request.body);
                retailers = parsed.retailers;
                mode = parsed.mode;
                workspace = parsed.workspace || 'beauty';
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

        // Construct Start URLs for all retailers
        const startUrls = [];

        if (workspace === 'beauty') {
            if (retailers.includes('Sephora')) {
                startUrls.push({
                    url: 'https://www.sephora.co.uk/new-at-sephora?filter=fh_location=//c1/en_GB/in_stock%3E{in}/new_in=1/!site_exclude%3E{79}&fh_view_size=120',
                    userData: { retailer: 'Sephora', label: 'LISTING' },
                });
            }
            if (retailers.includes('Holland & Barrett')) {
                startUrls.push({
                    url: 'https://www.hollandandbarrett.com/shop/health-wellness/?t=is_new%3Atrue',
                    userData: { retailer: 'Holland & Barrett', label: 'LISTING' },
                });
                startUrls.push({
                    url: 'https://www.hollandandbarrett.com/shop/natural-beauty/natural-beauty-shop-all/?t=is_new%3Atrue',
                    userData: { retailer: 'Holland & Barrett', label: 'LISTING' },
                });
            }
            if (retailers.includes('Boots')) {
                startUrls.push({
                    url: 'https://www.boots.com/new-to-boots/new-in-beauty',
                    userData: { retailer: 'Boots', label: 'LISTING' },
                });
            }
            if (retailers.includes('Superdrug')) {
                startUrls.push({
                    url: 'https://www.superdrug.com/new-in/c/new',
                    userData: { retailer: 'Superdrug', label: 'LISTING' },
                });
            }
        } else if (workspace === 'grocery') {
            const groceryMap = {
                'Sainsburys': 'https://www.sainsburys.co.uk/gol-ui/features/new-in',
                'Tesco': 'https://www.tesco.com/groceries/en-GB/search?query=new%20in',
                'Asda': 'https://groceries.asda.com/search/new%20in',
                'Morrisons': 'https://groceries.morrisons.com/categories/new/192077',
                'Ocado': 'https://www.ocado.com/search?entry=new%20in',
                'Waitrose': 'https://www.waitrose.com/ecom/shop/browse/groceries/new'
            };

            retailers.forEach(retailer => {
                if (groceryMap[retailer]) {
                    startUrls.push({ url: groceryMap[retailer], userData: { retailer, label: 'LISTING' } });
                }
            });
        }

        if (startUrls.length === 0) {
            return response.status(400).json({ error: 'No valid retailers found' });
        }

        console.log(`Starting universal custom scrape for ${startUrls.length} start URLs`);

        // Construct Webhook URL for background sync
        const host = request.headers.host;
        const protocol = request.headers['x-forwarded-proto'] || 'https';
        const webhookUrl = `${protocol}://${host}/api/run-status?workspace=${workspace}`;

        console.log(`Using webhook URL: ${webhookUrl}`);

        // Stage 1: Discovery (Cheap & Fast)
        console.log(`Starting Hybrid Discovery Phase for ${startUrls.length} start URLs...`);

        const run = await client.actor('apify/e-commerce-scraping-tool').start({
            listingUrls: startUrls.map(s => ({ url: s.url })),
            maxItemsPerStartUrl: 100, // Reduced from 1000 to prevent timeouts
            proxyConfiguration: { useApifyProxy: true },
            maxReviews: 5,
        }, {
            timeoutSecs: 240, // 4 minutes timeout
            webhooks: [
                {
                    eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.TIMED_OUT'], // Trigger even if timed out
                    requestUrl: `${protocol}://${host}/api/run-enrichment?workspace=${workspace}`
                }
            ]
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
