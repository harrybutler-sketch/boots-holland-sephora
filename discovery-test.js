
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

async function discoveryTest() {
    try {
        console.log('Starting discovery test for Sephora and Boots...');

        const startUrls = [
            {
                url: 'https://www.hollandandbarrett.com/shop/highlights/new-in/',
                userData: { label: 'LISTING', retailer: 'Holland & Barrett' },
            },
            {
                url: "https://www.sephora.co.uk/new-at-sephora",
                userData: { label: "LISTING", retailer: "Sephora" }
            },
            {
                url: "https://www.boots.com/new-to-boots/new-in-beauty",
                userData: { label: "LISTING", retailer: "Boots" }
            }
        ];

        const run = await client.actor('apify/puppeteer-scraper').start({
            startUrls: startUrls,
            proxyConfiguration: {
                useApifyProxy: true
            },
            // Limit pages to ensure we just tested a few from each
            maxPagesPerCrawl: 10,
            pageFunction: `async function pageFunction(context) {
                const { page, request, log, enqueueLinks } = context;
                const { label, retailer } = request.userData;
                
                log.info(\`Processing \${retailer}: \${request.url} [\${label}]\`);

                if (label === 'LISTING') {
                    // 1. Scroll to trigger lazy loading
                    await page.evaluate(async () => {
                        await new Promise((resolve) => {
                            let totalHeight = 0;
                            const distance = 100;
                            let scrolls = 0;
                            const timer = setInterval(() => {
                                window.scrollBy(0, distance);
                                totalHeight += distance;
                                scrolls++;
                                if (scrolls > 30) { clearInterval(timer); resolve(); }
                            }, 100);
                        });
                    });
                    
                    // 2. Enqueue Product Links based on Retailer patterns
                    let selector = '';
                    if (retailer === 'Holland & Barrett') {
                        selector = 'a[href*="/shop/product/"]';
                    } else if (retailer === 'Sephora') {
                        selector = 'a.Product-link';
                    } else if (retailer === 'Boots') {
                        selector = 'a.oct-teaser-wrapper-link, a.oct-teaser__title-link';
                    }

                    const info = await enqueueLinks({
                        selector: selector,
                        userData: { label: 'DETAIL', retailer }, // Pass retailer context
                        limit: 3 // Only queue a few per listing for test
                    });
                    
                    log.info(\`Enqueued \${info.processedRequests.length} products for \${retailer}\`);
                    return { type: 'LISTING', retailer, enqueued: info.processedRequests.length };
                } 
                
                if (label === 'DETAIL') {
                    // 3. Extract LD-JSON or Bazaarvoice to verify reviews
                     log.info('Extracting reviews for ' + retailer);
                     
                     // Wait a bit for dynamic content (Bazaarvoice/LD-JSON injection)
                     await new Promise(r => setTimeout(r, 5000));
                    
                    const data = await page.evaluate(() => {
                        const results = { reviewsFound: false, reviewCount: 0, rating: 0, method: 'none' };
                        
                        // Try LD-JSON first
                        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
                        for (const s of scripts) {
                            try {
                                const json = JSON.parse(s.innerText);
                                const product = Array.isArray(json) ? json.find(i => i['@type'] === 'Product') : (json['@type'] === 'Product' ? json : null);
                                if (product && product.aggregateRating) {
                                    results.reviewsFound = true;
                                    results.reviewCount = parseInt(product.aggregateRating.reviewCount);
                                    results.rating = parseFloat(product.aggregateRating.ratingValue);
                                    results.method = 'ld-json';
                                    return results;
                                }
                            } catch(e) {}
                        }
                        
                        // Try Bazaarvoice fallbacks
                        const bvCount = document.querySelector('.bv_numReviews_text, #bvRContainer-Link, [data-bv-show="rating_summary"]');
                        const bvRating = document.querySelector('.bv_avgRating_text, .bv_avgRating_component_container');
                        
                        if (bvCount) {
                            results.reviewsFound = true;
                            results.reviewCount = parseInt(bvCount.innerText.replace(/[^0-9]/g, '')) || 0;
                            if (bvRating) results.rating = parseFloat(bvRating.innerText) || 0;
                            results.method = 'bazaarvoice-dom';
                            return results;
                        }
                        
                        return results;
                    });

                    return {
                        type: 'DETAIL',
                        retailer,
                        url: request.url,
                        title: await page.title(),
                        ...data
                    };
                }
            }`
        });

        console.log(`Run started: ${run.id}`);

        // Poll for completion
        let status = 'RUNNING';
        while (status === 'RUNNING' || status === 'READY') {
            await new Promise(resolve => setTimeout(resolve, 5000));
            const runInfo = await client.run(run.id).get();
            status = runInfo.status;
            console.log(`Status: ${status}`);
        }

        if (status === 'SUCCEEDED') {
            console.log('Run Succeeded!');
            const dataset = await client.run(run.id).dataset();
            const { items } = await dataset.listItems();
            console.log('Items found:', items.length);
            // Filter to show DETAILS
            const details = items.filter(i => i.type === 'DETAIL');
            console.log('Product Details:', JSON.stringify(details, null, 2));
        } else {
            console.log('Run Failed.');
        }

    } catch (e) {
        console.error(e);
    }
}

discoveryTest();
