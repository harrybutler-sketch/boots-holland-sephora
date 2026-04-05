import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const APIFY_TOKEN = process.env.APIFY_TOKEN;

if (!APIFY_TOKEN) {
    console.error('Missing APIFY_TOKEN!');
    process.exit(1);
}

const client = new ApifyClient({ token: APIFY_TOKEN });

const targetUrls = [
    'https://www.sainsburys.co.uk/gol-ui/features/new-in-frozen',
    'https://www.sainsburys.co.uk/gol-ui/features/newdrinks/opt/page:1',
    'https://www.sainsburys.co.uk/gol-ui/features/newdrinks/opt/page:2',
    'https://www.sainsburys.co.uk/gol-ui/features/newdrinks/opt/page:3'
];

async function triggerScrape() {
    console.log('Triggering one-off Sainsbury\'s scrape for (Standard Proxy):');
    targetUrls.forEach(url => console.log(` - ${url}`));

    try {
        const run = await client.actor('apify/puppeteer-scraper').start({
            startUrls: targetUrls.map(url => ({ url })),
            useChrome: true,
            stealth: true,
            maxPagesPerCrawl: 100, 
            proxyConfiguration: { useApifyProxy: true }, // SIMPLIFIED PROXY
            pageFunction: `async function pageFunction(context) {
                const { page, request, log, enqueueLinks } = context;
                const url = request.url;
                const retailer = 'Sainsburys';
                log.info('Processing: ' + url);

                // If it's a listing page, enqueue products
                if (url.includes('/features/')) {
                    const selector = '.pt__link, a[href*="/gol-ui/product/"], a[href*="/product/"]';
                    
                    // Simple scroll
                    for (let i = 0; i < 5; i++) {
                        await page.evaluate(() => window.scrollBy(0, 1000));
                        await new Promise(r => setTimeout(r, 1000));
                    }

                    await enqueueLinks({
                        selector,
                        baseUrl: 'https://www.sainsburys.co.uk',
                        transformRequestFunction: (req) => {
                            if (req.url.includes('/product/')) return req;
                            return false;
                        }
                    });
                    return;
                }

                // If it's a product page, extract info
                if (url.includes('/product/')) {
                    const name = await page.$eval('h1', el => el.innerText.trim()).catch(() => 'Unknown');
                    const price = await page.$eval('[data-test-id="pd-retail-price"]', el => el.innerText.trim()).catch(() => '');
                    const brand = await page.$eval('.pd__brand', el => el.innerText.trim()).catch(() => '');
                    
                    const results = {
                        url,
                        name,
                        price,
                        brand,
                        retailer: 'Sainsburys',
                        category: 'Drinks',
                        scrape_timestamp: new Date().toISOString(),
                        reviews: 0
                    };

                    // Extract reviews
                    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
                    for (const s of scripts) {
                        try {
                            const json = JSON.parse(s.innerText);
                            const product = Array.isArray(json) ? json.find(i => i['@type'] === 'Product') : (json['@type'] === 'Product' ? json : null);
                            if (product && product.aggregateRating) {
                                results.reviews = parseInt(product.aggregateRating.reviewCount || product.aggregateRating.numberOfReviews) || 0;
                            }
                        } catch(e) {}
                    }

                    return results;
                }
            }`,
            timeoutSecs: 1800,
            pageFunctionTimeoutSecs: 180,
            requestHandlerTimeoutSecs: 180,
            navigationTimeoutSecs: 60
        });

        console.log(`Run started: ${run.id}`);
        console.log(`View progress: https://console.apify.com/actors/apify/puppeteer-scraper/runs/${run.id}`);
        
    } catch (error) {
        console.error('Trigger failed:', error);
    }
}

triggerScrape();
