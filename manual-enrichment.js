import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

async function triggerEnrichment() {
    const discoveryRunId = '13kwLQqZjbSHxzjJo'; // The aborted Sephora run
    const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

    console.log(`Fetching items from aborted run: ${discoveryRunId}...`);
    const { items } = await client.run(discoveryRunId).dataset().listItems();

    // Filter for valid product URLs
    const productUrls = items
        .filter(item => item.url && item.url.includes('http'))
        .map(item => ({ url: item.url, userData: { ...item, label: 'DETAIL' } }));

    if (productUrls.length === 0) {
        console.log('No products found to enrich.');
        return;
    }

    console.log(`Found ${productUrls.length} products. Starting Manual Puppet Bot (Enrichment)...`);

    // Start Puppeteer Scraper
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
    });

    console.log(`Manual Enrichment Started! 🚀`);
    console.log(`Enrichment Run ID: ${enrichmentRun.id}`);
    console.log(`Monitor it here: https://console.apify.com/actors/runs/${enrichmentRun.id}`);
}

triggerEnrichment();
