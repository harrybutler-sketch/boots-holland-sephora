import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

async function triggerTescoScrape() {
    const startUrls = [
        { 
            url: 'https://www.tesco.com/', 
            userData: { 
                retailer: 'Tesco', 
                label: 'LISTING',
                targetUrl: 'https://www.tesco.com/shop/en-GB/browse/drinks/all?sortBy=relevance&facetsArgs=new%3Atrue&count=24#top' 
            } 
        }
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
            pageFunction: `async ({ page, request, log, enqueueLinks, response, keyValueStore }) => {
                const { userData: { targetUrl, retailer, label } } = request;
                
                await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
                await page.setViewport({ width: 1920, height: 1080 });
                await page.setExtraHTTPHeaders({
                    'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Linux"',
                    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8'
                });

                // Warming/Bypass
                log.info('Warming Tesco session...');
                await page.goto('https://www.tesco.com/groceries/en-GB/', { waitUntil: 'networkidle2', timeout: 60000 }).catch((err) => log.warning('Warming navigation timed out: ' + err.message + ', continuing...'));
                await new Promise(r => setTimeout(r, 4000));
                
                // Map targetUrl to groceries format if needed
                let finalUrl = targetUrl;
                if (finalUrl && finalUrl.includes('/shop/en-GB/browse/')) {
                    finalUrl = finalUrl.replace('/shop/en-GB/browse/', '/groceries/en-GB/shop/');
                }
                
                log.info('Navigating to target: ' + finalUrl);
                await page.evaluate((target) => {
                    window.location.href = target;
                }, finalUrl);

                await page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }).catch(e => {
                    log.warning('Target navigation timed out: ' + e.message + ', continuing...');
                });
                await new Promise(r => setTimeout(r, 5000));

                // Save debug capture
                try {
                    const screenshot = await page.screenshot({ fullPage: true });
                    await keyValueStore.setValue('TESCO_PAGE_CAPTURE', screenshot, { contentType: 'image/png' });
                    const html = await page.content();
                    await keyValueStore.setValue('TESCO_PAGE_HTML', html, { contentType: 'text/html' });
                } catch (e) {
                    log.warning('Failed to save captures: ' + e.message);
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
