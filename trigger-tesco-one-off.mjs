import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

async function triggerTescoScrape() {
    const startUrls = [
        { url: 'https://www.tesco.com/groceries/en-GB/shop/treats-and-snacks/all?sortBy=relevance&facetsArgs=new%3Atrue', userData: { retailer: 'Tesco', label: 'LISTING' } },
        { url: 'https://www.tesco.com/groceries/en-GB/shop/food-cupboard/all?sortBy=relevance&facetsArgs=new%3Atrue', userData: { retailer: 'Tesco', label: 'LISTING' } }
    ];

    console.log('Triggering Tesco Finalized Scraper (Warming + DOM)...');

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
                const { url } = request;
                
                // 1. Desktop Headers
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
                await page.setViewport({ width: 1920, height: 1080 });

                // 2. Initial Block Check
                const blockInfo = await page.evaluate(() => {
                    const h1El = document.querySelector('h1');
                    const h1 = h1El ? h1El.innerText.trim() : '';
                    const title = document.title || '';
                    return {
                        isOops: h1.toLowerCase().includes('oops') || h1.toLowerCase().includes('not down this aisle') || title.toLowerCase().includes('access denied'),
                        h1, title
                    };
                });

                // 3. SESSION WARMING
                if (blockInfo.isOops) {
                    log.info('Oops detected. Warming session via homepage...');
                    await page.goto('https://www.tesco.com/groceries/en-GB/', { waitUntil: 'networkidle2', timeout: 30000 });
                    await new Promise(r => setTimeout(r, 2000));
                    log.info('Retrying category...');
                    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                }

                // 4. Extraction via DOM
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
                        const tile = nameEl.closest('div[class*="ProductTile"], li, [data-testid="product-tile"], div');
                        const priceEl = tile?.querySelector('p.ddsweb-price--primary, [data-testid="unit-price"], .price, [class*="price-details"], .ddsweb-price__value');
                        const name = nameEl?.innerText?.trim() || 'N/A';
                        
                        return {
                            name,
                            price_display: priceEl?.innerText?.trim() || 'N/A',
                            reviews: tile?.querySelector('div.ddsweb-star-rating, [data-testid="reviews-count"]')?.innerText?.match(/\\d+/)?.[0] || '0',
                            product_url: nameEl?.href,
                            isOwnBrand: name.toLowerCase().includes('tesco') || name.toLowerCase().includes('finest')
                        };
                    }).filter(p => !p.isOwnBrand && p.name !== 'N/A');
                });

                if (products) {
                    log.info('Extracted ' + products.length + ' products.');
                    return products;
                }
                return [];
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
