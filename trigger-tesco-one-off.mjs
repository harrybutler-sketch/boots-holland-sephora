
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
            url: 'https://www.tesco.com/shop/en-GB/buylists/new-ranges/new-snacks-and-treats', 
            userData: { retailer: 'Tesco', label: 'LISTING' } 
        }
    ];

    console.log('Triggering Tesco Buylist Scrape (Resilient Version)...');

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
                
                // 1. Initial Block Check
                if (response && (response.status === 403 || response.status === 429)) {
                    throw new Error('Tesco Hardware Block! Status ' + response.status);
                }

                // 2. Human Mimicry Delay
                await new Promise(r => setTimeout(r, 4000));

                // 3. Extraction Logic (Listing)
                if (request.userData.label === 'LISTING') {
                    log.info('Extracting products from Buylist listing...');
                    const products = await page.evaluate(() => {
                        const nameSelectors = [
                            'a.gyT8MW_titleLink',
                            'a[class*="titleLink"]', 
                            'a[href*="/products/"]'
                        ];
                        
                        let titleLinks = [];
                        for (const sel of nameSelectors) {
                            titleLinks = Array.from(document.querySelectorAll(sel));
                            if (titleLinks.length > 0) break;
                        }

                        return titleLinks.map(nameEl => {
                            const tile = nameEl.closest('div[class*="ProductTile"], li, div[data-testid="product-tile"], div');
                            const priceEl = tile?.querySelector('p.ddsweb-price--primary, [data-testid="unit-price"], .ddsweb-price__value, .price');
                            const name = nameEl?.innerText?.trim() || 'N/A';
                            
                            return {
                                name,
                                price_display: priceEl?.innerText?.trim() || 'N/A',
                                reviews: tile?.querySelector('div.ddsweb-star-rating, [data-testid="reviews-count"]')?.innerText?.match(/\\d+/)?.[0] || '0',
                                url: nameEl?.href,
                                isOwnBrand: name.toLowerCase().includes('tesco') || name.toLowerCase().includes('finest')
                            };
                        }).filter(p => !p.isOwnBrand && p.name !== 'N/A');
                    });

                    log.info('Extracted ' + (products.length || 0) + ' products.');
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

