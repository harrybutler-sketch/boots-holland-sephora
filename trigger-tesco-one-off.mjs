
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Tesco Scraper v2.3.7 (The "Absolute Success" Sync)
 * - Fixed response.status syntax (Property check)
 * - Added Redundant Screen-Text Block Detection
 * - Strict UK Residential Proxy Lock
 * - Standardized enqueueLinks context
 */

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

async function triggerTescoScrape() {
    const startUrls = [
        { 
            url: 'https://www.tesco.com/shop/en-GB/buylists/new-ranges/plant-based-and-vegetarian#plant-based-and-vegetarian', 
            userData: { retailer: 'Tesco', label: 'LISTING' } 
        }
    ];

    console.log('Triggering Tesco 2.3.7 Scrape (Verified Syntax) for:', startUrls[0].url);

    try {
        const run = await client.actor('apify/puppeteer-scraper').start({
            startUrls,
            maxConcurrency: 1,
            proxyConfiguration: { 
                useApifyProxy: true, 
                apifyProxyGroups: ['RESIDENTIAL'], 
                countryCode: 'GB' 
            },
            launchContext: { useChrome: true },
            useStealth: true,
            fingerprinting: true,
            pageFunction: `async ({ page, request, log, enqueueLinks, response }) => {
                const retailer = request.userData.retailer || 'Tesco';
                
                // 1. Strict Block/Status Check (Property syntax)
                if (response && response.status !== 200) {
                    throw new Error('Tesco Blocked! Status ' + response.status + ' at ' + request.url + '. Retrying with fresh UK proxy...');
                }

                // 2. Redundant Text Block Check (Screen-level)
                const isPageBlocked = await page.evaluate(() => {
                    const t = document.body.innerText.toLowerCase();
                    return t.includes('access denied') || t.includes('oops') || t.includes("it's not you, it's us") || t.includes('something went wrong');
                });
                
                if (isPageBlocked) {
                    throw new Error('Tesco Stealth Block (Screen text detected). Retrying...');
                }

                // 3. Listing Logic (Verified Context)
                if (request.userData.label === 'LISTING') {
                    await page.waitForSelector('h1', { timeout: 30000 });
                    const linksCount = await enqueueLinks({
                        selector: 'a[href*="/products/"]',
                        label: 'DETAIL'
                    });
                    log.info('Successfully enqueued ' + (linksCount.length || 0) + ' product links.');
                } 
                
                // 4. Detail Page Logic (Extraction)
                else if (request.userData.label === 'DETAIL') {
                    await page.waitForSelector('h1', { timeout: 25000 });
                    
                    const extraction = await page.evaluate(() => {
                        const h1 = document.querySelector('h1');
                        const priceEl = document.querySelector('.ddsweb-price__value, [data-testid="price-per-sellable-unit"], .price-per-sellable-unit');
                        const results = {
                            name: h1 ? h1.innerText.trim() : 'Unknown',
                            price_display: priceEl ? priceEl.innerText.trim() : 'N/A',
                            reviews: document.querySelector('[data-testid="reviews-count"], .reviews-count')?.innerText?.replace(/[()]/g, '') || '0',
                            url: window.location.href,
                            isOwnBrand: (document.querySelector('h1')?.innerText || '').toLowerCase().includes('tesco')
                        };
                        
                        // Marketplace check
                        const isMarketplace = Array.from(document.querySelectorAll('a, span, div, li')).some(el => {
                            const t = el.innerText ? el.innerText.trim().toLowerCase() : '';
                            return t === 'marketplace' || t.includes('sold and shipped by');
                        });
                        if (isMarketplace || window.location.href.toLowerCase().includes('marketplace')) {
                            results.isMarketplace = true;
                        }
                        
                        return results;
                    });

                    // Avoid saving empty shells or own-brands
                    if (!extraction.name || extraction.name === 'Unknown' || extraction.isOwnBrand || extraction.isMarketplace) {
                        return null; 
                    }
                    
                    return extraction;
                }
            }`,
            timeoutSecs: 1800,
            pageFunctionTimeoutSecs: 180,
            requestHandlerTimeoutSecs: 180
        });

        console.log('Scrape started! Run ID:', run.id);
        console.log('View run at:', `https://console.apify.com/view/runs/${run.id}`);
    } catch (e) {
        console.error('Trigger Error:', e);
    }
}

triggerTescoScrape();
