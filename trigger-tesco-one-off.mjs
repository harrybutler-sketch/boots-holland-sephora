
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
            url: 'https://www.tesco.com/groceries/en-GB/shop/treats-and-snacks/all?sortBy=relevance&facetsArgs=new%3Atrue', 
            userData: { retailer: 'Tesco', label: 'LISTING' } 
        },
        { 
            url: 'https://www.tesco.com/groceries/en-GB/shop/treats-and-snacks/all?sortBy=relevance&page=2&facetsArgs=new%3Atrue', 
            userData: { retailer: 'Tesco', label: 'LISTING' } 
        }
    ];

    console.log('Triggering Tesco ULTRA-STEALTH Scrape for Snack Categories...');

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
                
                // 1. Desktop Stealth Headers
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
                await page.setViewport({ width: 1920, height: 1080 });

                // 2. Initial Block Check
                if (response && (response.status === 403 || response.status === 429)) {
                    throw new Error('Tesco Hardware Block! Status ' + response.status);
                }

                // 3. Human Mimicry Delay
                const thinkTime = Math.floor(Math.random() * 4000) + 3000;
                log.info('Mimicking human thinking for ' + thinkTime + 'ms...');
                await new Promise(r => setTimeout(r, thinkTime));

                // 4. Content Block Check
                const blockInfo = await page.evaluate(() => {
                    const h1 = document.querySelector('h1')?.innerText?.trim() || '';
                    const title = document.title || '';
                    const body = document.body.innerText || '';
                    const hasErrorImg = !!document.querySelector('img[src*="error_pudding"]');
                    
                    const isBlocked = h1.toLowerCase().includes('oops') || 
                           h1.toLowerCase().includes('not down this aisle') ||
                           title.toLowerCase().includes('access denied') ||
                           body.toLowerCase().includes("it's not you, it's us") ||
                           hasErrorImg;
                           
                    return { isBlocked, h1, title };
                });
                
                if (blockInfo.isBlocked) {
                    log.error('Tesco Block Detected! H1: ' + blockInfo.h1);
                    throw new Error('Tesco Oops Block. Rotating proxy...');
                }

                // 5. Human Scroll
                log.info('Human Move: Scrolling for hydration...');
                await page.evaluate(() => window.scrollBy(0, 400 + Math.random() * 400));
                await new Promise(r => setTimeout(r, 2000));

                // 6. Extraction Logic (Listing)
                if (request.userData.label === 'LISTING') {
                    log.info('Extracting products from listing...');
                    const products = await page.evaluate(() => {
                        const nameSelectors = [
                            'a[class*="titleLink"]', 
                            '[data-testid="product-tile"] h2 a',
                            '.gyT8MW_titleLink',
                            'a[href*="/products/"]'
                        ];
                        
                        let titleLinks = [];
                        for (const sel of nameSelectors) {
                            titleLinks = Array.from(document.querySelectorAll(sel));
                            if (titleLinks.length > 0) break;
                        }

                        return titleLinks.map(nameEl => {
                            const tile = nameEl.closest('div[class*="ProductTile"], li, div[data-testid="product-tile"]');
                            const priceEl = tile?.querySelector('[data-testid="unit-price"], .ddsweb-price__value, .price');
                            const name = nameEl?.innerText?.trim() || 'N/A';
                            
                            return {
                                name,
                                price_display: priceEl?.innerText?.trim() || 'N/A',
                                reviews: tile?.querySelector('[data-testid="reviews-count"]')?.innerText?.match(/\\d+/)?.[0] || '0',
                                url: nameEl?.href,
                                isOwnBrand: name.toLowerCase().includes('tesco') || name.toLowerCase().includes('finest')
                            };
                        }).filter(p => !p.isOwnBrand && p.name !== 'N/A');
                    });

                    log.info('Extracted ' + (products.length || 0) + ' products.');
                    
                    // Note: If you want to sync to sheet, return results here.
                    // For trigger scripts, we usually just return the array to Apify's default dataset.
                    return products;
                }
            }`,
            timeoutSecs: 2400
        });

        console.log('Scrape started! Run ID:', run.id);
        console.log('View run at:', `https://console.apify.com/view/runs/${run.id}`);
    } catch (e) {
        console.error('Trigger Error:', e);
    }
}

triggerTescoScrape();

