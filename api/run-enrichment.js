import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

export default async function handler(request, response) {
    // Allow POST (Apify Webhook)
    if (request.method !== 'POST') {
        return response.status(405).send('Method Not Allowed');
    }

    const { workspace = 'beauty' } = request.query;

    try {
        const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
        const discoveryRunId = body.eventData?.actorRunId;

        if (!discoveryRunId) {
            return response.status(400).json({ error: 'No discovery runId found in webhook' });
        }

        const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

        // 1. Fetch discovered products
        console.log(`Enriching results from discovery run: ${discoveryRunId}`);
        const { items } = await client.run(discoveryRunId).dataset().listItems();

        // Filter for valid product URLs
        const productUrls = items
            .filter(item => item.url && item.url.includes('http'))
            .map(item => ({ url: item.url, userData: { ...item, label: 'DETAIL' } }));

        if (productUrls.length === 0) {
            console.log('No products found in discovery phase. Skipping enrichment.');
            return response.status(200).json({ message: 'No products to enrich' });
        }

        console.log(`Found ${productUrls.length} products. Starting enrichment phase...`);

        // 2. Start Targeted Playwright Scraper
        const host = request.headers.host;
        const protocol = request.headers['x-forwarded-proto'] || 'https';
        const finalWebhookUrl = `${protocol}://${host}/api/run-status?workspace=${workspace}`;

        const enrichmentRun = await client.actor('apify/puppeteer-scraper').start({
            startUrls: productUrls,
            proxyConfiguration: { useApifyProxy: true },
            maxPagesPerCrawl: productUrls.length + 10,
            pageFunction: `async function pageFunction(context) {
                const { page, request, log } = context;
                const { retailer, url } = request.userData;
                
                log.info(\`Enriching: \` + request.url);
                
                // Wait for dynamic reviews to load
                await new Promise(r => setTimeout(r, 5000));
                
                const enrichment = await page.evaluate((retailer) => {
                    const res = { reviews: 0, rating: 0, image: "" };
                    
                    // Try JSON-LD first
                    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
                    for (const s of scripts) {
                        try {
                            const json = JSON.parse(s.innerText);
                            const product = Array.isArray(json) ? json.find(i => i["@type"] === "Product") : (json["@type"] === "Product" ? json : null);
                            if (product && product.aggregateRating) {
                                res.rating = parseFloat(product.aggregateRating.ratingValue);
                                res.reviews = parseInt(product.aggregateRating.reviewCount || product.aggregateRating.ratingCount);
                            }
                            if (product && product.image) res.image = Array.isArray(product.image) ? product.image[0] : product.image;
                        } catch(e) {}
                    }
                    
                    // DOM Fallbacks for Reviews
                    if (res.reviews === 0) {
                        const bv = document.querySelector('.bv_numReviews_text, [data-bv-show="rating_summary"]');
                        if (bv) res.reviews = parseInt(bv.innerText.replace(/[^0-9]/g, "")) || 0;
                    }
                    
                    // Image fallback
                    if (!res.image) res.image = document.querySelector('meta[property="og:image"]')?.content;
                    
                    return res;
                }, retailer);

                return { ...request.userData, ...enrichment, status: 'Enriched' };
            }`
        }, {
            webhooks: [
                {
                    eventTypes: ['ACTOR.RUN.SUCCEEDED'],
                    requestUrl: finalWebhookUrl
                }
            ]
        });

        return response.status(200).json({
            enrichmentRunId: enrichmentRun.id,
            productCount: productUrls.length
        });

    } catch (error) {
        console.error('Enrichment error:', error);
        return response.status(500).json({ error: error.message });
    }
}
