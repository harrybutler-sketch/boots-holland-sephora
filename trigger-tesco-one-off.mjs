import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

async function triggerTescoScrape() {
    const startUrls = [
        { url: 'https://www.tesco.com/groceries/en-GB/shop/drinks/all?sortBy=relevance&facetsArgs=new%3Atrue&count=24', userData: { retailer: 'Tesco', label: 'LISTING' } }
    ];

    console.log('Triggering Tesco RESILIENT Scraper (April 7th Logic)...');

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
            pageFunction: `async ({ page, request, log, response }) => {
                const { url, userData: { retailer, label } } = request;
                
                // 1. Desktop Stealth Headers
                await page.setViewport({ width: 1920, height: 1080 });
                await page.setExtraHTTPHeaders({
                    'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"',
                    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
                    'referer': 'https://www.google.com/'
                });

                // 2. Initial Status Check
                if (response && response.status === 403) {
                    throw new Error('Tesco Block (Status ' + response.status + '). Rotating proxy...');
                }

                // 3. Human Mimicry: Initial Delay
                const thinkTime = Math.floor(Math.random() * 4000) + 3000;
                log.info(\`Mimicking human thinking for \${thinkTime}ms...\`);
                await new Promise(r => setTimeout(r, thinkTime));

                // 4. Content Check & Stealth Block Detection
                const blockInfo = await page.evaluate(() => {
                    const h1El = document.querySelector('h1');
                    const h1 = h1El ? h1El.innerText.trim() : '';
                    const title = document.title || '';
                    const body = document.body ? document.body.innerText : '';
                    return {
                        isOops: h1.toLowerCase().includes('oops') || h1.toLowerCase().includes('not down this aisle') || title.toLowerCase().includes('access denied') || body.toLowerCase().includes("it's not you, it's us"),
                        h1, title
                    };
                });

                // 5. Session Warming (Final resort bypass)
                if (blockInfo.isOops || !url.includes('groceries')) {
                    log.info('Warming Session: Hitting homepage first...');
                    await page.goto('https://www.tesco.com/groceries/en-GB/', { waitUntil: 'networkidle2', timeout: 30000 }).catch(e => log.warning('Warming failed: ' + e.message));
                    await new Promise(r => setTimeout(r, 2000));
                    log.info('Session Warmed. Retrying category: ' + url);
                    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                }

                // 6. Explicit MFE Hydration
                log.info('Waiting for product grid hydration...');
                await page.evaluate(() => window.scrollBy(0, 800));
                await page.waitForSelector('.product-list--list-item, [class*="ProductTile"], .gyT8MW_titleLink', { timeout: 20000 }).catch(() => log.warning('Product grid timed out.'));
                await new Promise(r => setTimeout(r, 3000));

                // 7. Extraction via DOM
                log.info('Extracting products from DOM...');
                const products = await page.evaluate(() => {
                    const nameSelectors = [
                        'a.gyT8MW_titleLink',
                        'a[class*="titleLink"]', 
                        '[data-testid="product-tile"] h2 a',
                        'a[href*="/products/"]'
                    ];
                    
                    let titleLinks = [];
                    for (const sel of nameSelectors) {
                        titleLinks = Array.from(document.querySelectorAll(sel));
                        if (titleLinks.length > 0) break;
                    }

                    return titleLinks.map(nameEl => {
                        const tile = nameEl.closest('li, div[class*="ProductTile"], [data-testid="product-tile"], div');
                        const priceEl = tile?.querySelector('p.ddsweb-price--primary, [data-testid="unit-price"], .price, .ddsweb-price__text, [class*="price"]');
                        const imgEl = tile?.querySelector('img[class*="product-image"], a[class*="imageContainer"] img, img');
                        const reviewEl = tile?.querySelector('div.ddsweb-star-rating, [data-testid="reviews-count"], [class*="review-count"]');
                        
                        const name = nameEl?.innerText?.trim() || 'N/A';
                        if (name === 'N/A' || name.length < 3) return null;

                        // Improved price extraction
                        let price = priceEl?.innerText?.trim() || 'N/A';
                        if (price === 'N/A' && tile) {
                            const allP = Array.from(tile.querySelectorAll('p, span'));
                            const pMatch = allP.find(p => p.innerText.includes('£'));
                            if (pMatch) price = pMatch.innerText.trim();
                        }

                        const res = {
                            product_name: name,
                            retailer: 'Tesco',
                            price_display: price,
                            reviews: 0,
                            rating: '0.0',
                            image_url: imgEl?.src || '',
                            product_url: nameEl?.href || window.location.href,
                            manufacturer: name.split(' ')[0],
                            date_found: new Date().toISOString()
                        };
                        
                        if (reviewEl) {
                            const rText = reviewEl.innerText;
                            const match = rText.match(/(\\d+)/);
                            if (match) res.reviews = parseInt(match[0]) || 0;
                            const ratingMatch = rText.match(/(\\d+\\.\\d+)/);
                            if (ratingMatch) res.rating = ratingMatch[1];
                        }
                        return res;
                    }).filter(Boolean);
                });

                if (!products || products.length === 0) {
                    log.warning('No products found on page. DOM might not have loaded or layout changed.');
                    return [];
                }

                // 7. Filter (Quality Control)
                const filtered = products.filter(p => {
                    const ln = p.product_name.toLowerCase();
                    const isOwnBrand = ln.includes('tesco') || ln.includes('finest') || ln.includes('stockwell') || ln.includes('ms molly');
                    return p.reviews <= 5 && !isOwnBrand;
                });

                log.info(\`Extracted \${filtered.length} products (found \${products.length} total)\`);
                
                return filtered;
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

