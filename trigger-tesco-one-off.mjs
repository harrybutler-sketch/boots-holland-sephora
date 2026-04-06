
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Tesco Scraper v2.3.9 (The "Final Resolution" Sync)
 * - Comprehensive Block Detection: H1 "Oops", "Not down this aisle", "Access Denied"
 * - Title-Level Awareness: Detects [Error - Tesco Groceries] and [Access Denied]
 * - Debug Logging: Explicitly logs H1 text for detail-page transparency
 * - Extraction Guard: Rejects "Oops" or "Aisle" names to prevent empty results
 * - Increased Load Delays: 12s detail-page wait for full hydration
 * - Strict UK Residential Proxy Lock
 */

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

async function triggerTescoScrape() {
    const startUrls = [
        { 
            url: 'https://www.tesco.com/groceries/en-GB/shop/treats-and-snacks/all?sortBy=relevance&facetsArgs=new%3Atrue&count=24#top', 
            userData: { retailer: 'Tesco', label: 'LISTING' } 
        },
        { 
            url: 'https://www.tesco.com/groceries/en-GB/shop/treats-and-snacks/all?sortBy=relevance&page=2&facetsArgs=new%3Atrue&count=24#top', 
            userData: { retailer: 'Tesco', label: 'LISTING' } 
        }
    ];

    console.log('Triggering Tesco 2.3.9 Scrape (Final Fix) for:', startUrls[0].url);

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
            pageFunction: `async function pageFunction(context) {
                const { page, request, log, enqueueLinks, response } = context;
                const retailer = request.userData.retailer || 'Tesco';
                
                // 1. Strict Block/Status Check
                if (response && (response.status === 403 || response.status === 429)) {
                    throw new Error('Tesco Hardware Block! Status ' + response.status + ' at ' + request.url);
                }

                // 2. WAIT for Initial Render
                await page.waitForSelector('h1, .error-page-container, [src*="error_pudding"], .heading', { timeout: 15000 }).catch(() => {});

                // 3. Robust "Oops" & Stealth Block Check
                const blockInfo = await page.evaluate(() => {
                    const h1 = document.querySelector('h1')?.innerText?.trim() || '';
                    const title = document.title || '';
                    const body = document.body.innerText || '';
                    const hasErrorImg = !!document.querySelector('img[src*="error_pudding"]');
                    
                    const isBlocked = h1.toLowerCase().includes('oops') || 
                           h1.toLowerCase().includes('not right') || 
                           h1.toLowerCase().includes('not down this aisle') ||
                           title.toLowerCase().includes('access denied') ||
                           title.toLowerCase().includes('error - tesco') ||
                           body.toLowerCase().includes('access denied') || 
                           body.toLowerCase().includes("it's not you, it's us") || 
                           body.toLowerCase().includes('something went wrong') ||
                           hasErrorImg;
                           
                    return { isBlocked, h1, title };
                });
                
                if (blockInfo.isBlocked) {
                    log.error('Tesco Block Detected! Title: ' + blockInfo.title + ' | H1: ' + blockInfo.h1);
                    throw new Error('Tesco Stealth Block (Error Page: ' + blockInfo.h1 + '). Retrying...');
                }

                // 4. Listing Logic
                if (request.userData.label === 'LISTING') {
                    await page.waitForSelector('a[href*="/products/"]', { timeout: 30000 });
                    const linksCount = await enqueueLinks({
                        selector: 'a[href*="/products/"]',
                        label: 'DETAIL'
                    });
                    log.info('Successfully enqueued ' + (linksCount.length || 0) + ' product links.');
                } 
                
                // 5. Detail Page Logic (Extraction)
                else if (request.userData.label === 'DETAIL') {
                    log.info('H1 Text on arrival: ' + blockInfo.h1);
                    log.info('Waiting 12s for full hydration...');
                    await new Promise(r => setTimeout(r, 12000));
                    
                    const extraction = await page.evaluate(() => {
                        const h1 = document.querySelector('h1');
                        const priceEl = document.querySelector('.ddsweb-price__value, [data-testid="price-per-sellable-unit"], .price-per-sellable-unit');
                        
                        const h1Text = h1 ? h1.innerText.replace(/\\n/g, ' ').trim() : 'Unknown';
                        
                        // Results focus: Name and URL first
                        const results = {
                            name: h1Text,
                            price_display: priceEl ? priceEl.innerText.trim() : 'N/A',
                            reviews: document.querySelector('[data-testid="reviews-count"], .reviews-count')?.innerText?.replace(/[()]/g, '') || '0',
                            url: window.location.href,
                            isOwnBrand: h1Text.toLowerCase().includes('tesco')
                        };
                        
                        // Guard against "Oops" sneaking into extraction
                        const n = results.name.toLowerCase();
                        if (n.includes('oops') || n.includes('not right') || n.includes('aisle') || n.includes('error')) {
                            results.status = 'ERROR_PAGE';
                        }
                        
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

                    // Verification: If name is an error, throw to retry
                    if (extraction.status === 'ERROR_PAGE') {
                        throw new Error('Extraction Guard: Captured Oops/Error heading: ' + extraction.name + '. Retrying...');
                    }

                    // Avoid saving empty shells, own-brands, or marketplace items
                    if (!extraction.name || extraction.name === 'Unknown' || extraction.isOwnBrand || extraction.isMarketplace) {
                        return null; 
                    }
                    
                    return extraction;
                }
            }`,
            timeoutSecs: 2400,
            pageFunctionTimeoutSecs: 400,
            requestHandlerTimeoutSecs: 400
        });

        console.log('Scrape started! Run ID:', run.id);
        console.log('View run at:', `https://console.apify.com/view/runs/${run.id}`);
    } catch (e) {
        console.error('Trigger Error:', e);
    }
}

triggerTescoScrape();

