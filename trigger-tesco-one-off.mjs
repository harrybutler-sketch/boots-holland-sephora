import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

async function triggerTescoScrape() {
    const startUrls = [
        { url: 'https://www.tesco.com/groceries/en-GB/shop/drinks/all?sortBy=relevance&facetsArgs=new%3Atrue&count=24', userData: { retailer: 'Tesco', label: 'LISTING' } }
    ];

    console.log('Triggering Tesco RESILIENT Scraper (Restored April 27th Logic)...');

    try {
        const run = await client.actor('apify/puppeteer-scraper').start({
            startUrls,
            maxConcurrency: 1,
            proxyConfiguration: { 
                useApifyProxy: true, 
                apifyProxyGroups: ['RESIDENTIAL'], 
                countryCode: 'GB' 
            },
            useStealth: true,
            useChrome: true,
            requestHandlerTimeoutSecs: 600,
            pageFunctionTimeoutSecs: 600,
            handlePageTimeoutSecs: 600,
            navigationTimeoutSecs: 120,
            pageFunction: `async ({ page, request, log, enqueueLinks, response }) => {
                const { url, userData: { retailer, label } } = request;
                
                await page.setViewport({ width: 1920, height: 1080 });
                await page.setExtraHTTPHeaders({
                    'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"',
                    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
                    'referer': 'https://www.google.com/'
                });

                // Warming/Bypass
                log.info('Warming Tesco session...');
                await page.goto('https://www.tesco.com/groceries/en-GB/', { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => log.warning('Warming navigation timed out, continuing...'));
                await new Promise(r => setTimeout(r, 3000));
                
                log.info('Navigating to target: ' + url);
                const navResponse = await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 }).catch(e => {
                    log.error('Primary navigation failed: ' + e.message);
                    return null;
                });

                if (!navResponse) {
                    log.warning('Attempting to proceed despite navigation error...');
                }

                // Cookie Acceptance
                try {
                    const cookieId = 'button.ddsweb-consent-banner__button';
                    await page.waitForSelector(cookieId, { timeout: 8000 });
                    await page.click(cookieId);
                    await new Promise(r => setTimeout(r, 1500));
                } catch (e) {
                    log.info('Cookie banner not found or already accepted.');
                }

                // Wait for products - more robust selectors
                log.info('Waiting for product items...');
                const productSelector = 'li[class*="Tile"], [data-testid="product-tile"], .product-list--item, .styles__StyledTiledQueryResult-sc';
                await page.waitForSelector(productSelector, { timeout: 45000 }).catch(() => log.warning('Timeout waiting for products. Still attempting extraction.'));

                // Scroll for hydration
                log.info('Scrolling for hydration...');
                for (let i = 0; i < 12; i++) {
                    await page.evaluate(() => window.scrollBy(0, 800));
                    await new Promise(r => setTimeout(r, 800));
                }

                // Extraction
                const products = await page.evaluate(() => {
                    const tiles = Array.from(document.querySelectorAll('li[class*="Tile"], [data-testid="product-tile"], .product-list--item, article, [class*="StyledTiledQueryResult"] li'));
                    return tiles.map(tile => {
                        const nameEl = tile.querySelector('h2 a, a[class*="titleLink"], a[href*="/products/"], [data-testid="product-title"]');
                        if (!nameEl) return null;
                        const name = nameEl.innerText.trim();
                        if (!name || name.length < 3) return null;

                        const priceEl = tile.querySelector('p[class*="priceText"], .ddsweb-price--primary, [data-testid="unit-price"], .price, .styles__StyledPrice-sc');
                        const imgEl = tile.querySelector('img');

                        return {
                            product_name: name,
                            retailer: 'Tesco',
                            price_display: priceEl?.innerText?.trim() || 'N/A',
                            product_url: nameEl.href || window.location.href,
                            image_url: imgEl?.src || '',
                            date_found: new Date().toISOString()
                        };
                    }).filter(Boolean);
                });

                log.info(\`Found \${products.length} products total.\`);

                const filtered = products.filter(p => {
                    const ln = p.product_name.toLowerCase();
                    const isOwnBrand = ln.includes('tesco') || ln.includes('finest') || ln.includes('stockwell') || ln.includes('ms price');
                    return !isOwnBrand;
                });

                log.info(\`Filtered to \${filtered.length} non-own-brand products.\`);

                await enqueueLinks({ 
                    selector: 'a[aria-label*="next page"], [data-testid="pagination-next"], a.pagination--button--next', 
                    label: 'LISTING', 
                    userData: { retailer: 'Tesco' } 
                }).catch(() => {});

                return filtered;
            }`,
            timeoutSecs: 3600
        });

        console.log('Scrape started! Run ID:', run.id);
        console.log('View run at:', `https://console.apify.com/actors/apify/puppeteer-scraper/runs/${run.id}`);
    } catch (e) {
        console.error('Trigger Error:', e);
    }
}

triggerTescoScrape();
