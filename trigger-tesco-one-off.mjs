import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

async function triggerTescoScrape() {
    const startUrls = [
        { url: 'https://www.tesco.com/groceries/en-GB/shop/treats-and-snacks/all?sortBy=relevance&facetsArgs=new%3Atrue', userData: { retailer: 'Tesco', label: 'LISTING' } },
        { url: 'https://www.tesco.com/groceries/en-GB/shop/food-cupboard/all?sortBy=relevance&facetsArgs=new%3Atrue', userData: { retailer: 'Tesco', label: 'LISTING' } }
    ];

    console.log('Triggering Tesco "Session Warming" Scraper...');

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

                // 2. Initial Delay
                await new Promise(r => setTimeout(r, 3000));

                // 3. Block Detection (Safe)
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

                // 4. SESSION WARMING BYPASS
                if (blockInfo.isOops) {
                    log.info('Oops detected. Warming session via homepage...');
                    await page.goto('https://www.tesco.com/groceries/en-GB/', { waitUntil: 'networkidle2', timeout: 30000 });
                    await new Promise(r => setTimeout(r, 2000));
                    log.info('Retrying category after warming...');
                    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                }

                // 5. Extraction via Asparagus Data
                log.info('Extracting from Asparagus Data...');
                const products = await page.evaluate(() => {
                    const script = document.querySelector('script[type="asparagus-data"]');
                    if (!script) return null;
                    try {
                        const data = JSON.parse(script.textContent);
                        const plp = data?.props?.['mfe-plp']?.props?.data;
                        const items = plp?.category?.productItems || plp?.search?.productItems || [];
                        
                        if (!items.length && data?.props?.['mfe-product-list']?.props?.data) {
                            return data.props['mfe-product-list'].props.data.productItems.map(item => ({
                                name: item.title || 'N/A',
                                price_display: item.price?.actualPrice?.toString() || 'N/A',
                                reviews: item.ratings?.numberOfReviews || 0,
                                product_url: item.id ? 'https://www.tesco.com/groceries/en-GB/products/' + item.id : window.location.href,
                                isOwnBrand: (item.title || '').toLowerCase().includes('tesco') || (item.title || '').toLowerCase().includes('finest')
                            }));
                        }

                        return items.map(item => ({
                            name: item.title || 'N/A',
                            price_display: item.price?.actualPrice?.toString() || 'N/A',
                            reviews: item.ratings?.numberOfReviews || 0,
                            product_url: item.id ? 'https://www.tesco.com/groceries/en-GB/products/' + item.id : window.location.href,
                            isOwnBrand: (item.title || '').toLowerCase().includes('tesco') || (item.title || '').toLowerCase().includes('finest')
                        }));
                    } catch (e) {
                        return null;
                    }
                });

                if (products) {
                    log.info('Extracted ' + products.length + ' products.');
                    return products.filter(p => !p.isOwnBrand);
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
