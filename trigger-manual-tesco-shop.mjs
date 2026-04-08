import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

const TARGET_URL = 'https://www.tesco.com/groceries/en-GB/shop/treats-and-snacks/all?sortBy=relevance&page=2&facetsArgs=new%3Atrue';

async function triggerManualTesco() {
    console.log('Triggering Manual Tesco Scrape (Page 2) with Buylist Logic...');
    
    try {
        const run = await client.actor('apify/puppeteer-scraper').start({
            startUrls: [{ url: TARGET_URL, userData: { retailer: 'Tesco', label: 'LISTING' } }],
            useChrome: true,
            useStealth: true,
            proxyConfiguration: { 
                useApifyProxy: true, 
                apifyProxyGroups: ['RESIDENTIAL'], 
                countryCode: 'GB' 
            },
            pageFunction: `async function pageFunction(context) {
                const { page, request, log } = context;
                const { label, retailer } = request.userData;
                
                if (label === 'LISTING') {
                    log.info('LISTING PAGE: ' + request.url);
                    await page.setViewport({ width: 1920, height: 1080 });
                    
                    // 1. Initial Load and Block Check
                    await new Promise(r => setTimeout(r, 5000));
                    const isBlocked = await page.evaluate(() => {
                        const h1 = document.querySelector('h1')?.innerText?.toLowerCase() || '';
                        return h1.includes('oops') || h1.includes('access denied') || document.title.toLowerCase().includes('access denied');
                    });

                    if (isBlocked) {
                        log.info('Detected block/Oops. Warming session via homepage...');
                        await page.goto('https://www.tesco.com/groceries/en-GB/', { waitUntil: 'networkidle2', timeout: 30000 });
                        await new Promise(r => setTimeout(r, 3000));
                        log.info('Retrying category URL...');
                        await page.goto(request.url, { waitUntil: 'networkidle2', timeout: 30000 });
                    }
                    
                    // 2. Wait for Hydration
                    log.info('Waiting for product grid hydration...');
                    try {
                        await page.waitForSelector('.product-list--list-item, [data-testid="product-tile"], .gyT8MW_titleLink, [class*="productTile"]', { timeout: 45000 });
                        log.info('Product grid detected.');
                    } catch (e) {
                        log.warning('Timed out waiting for grid. Trying to extract whatever is there.');
                    }

                    // 3. Cookie Banner (Secondary Check)
                    try {
                        const btn = await page.$('#onetrust-accept-btn-handler');
                        if (btn) {
                            await btn.click();
                            log.info('Cookie banner accepted.');
                            await new Promise(r => setTimeout(r, 3000));
                        }
                    } catch (e) {}
                    
                    // 4. Heavy Scrolling
                    log.info('Scrolling for links...');
                    for (let i = 0; i < 10; i++) {
                        await page.evaluate(() => window.scrollBy(0, 1000));
                        await new Promise(r => setTimeout(r, 2000));
                    }
                    
                    // 5. Link Extraction
                    const links = await page.evaluate(() => {
                        const sel = 'a[href*="/products/"]:not([href*="onetrust"]), a.gyT8MW_titleLink, [class*="titleLink"] a, [data-testid="product-tile"] a';
                        return Array.from(document.querySelectorAll(sel))
                            .map(a => a.href)
                            .filter(href => href && href.includes('/products/') && !href.includes('onetrust'));
                    });
                    
                    const uniqueLinks = Array.from(new Set(links));
                    log.info('Found ' + uniqueLinks.length + ' unique product links.');

                    if (uniqueLinks.length === 0) {
                        const title = await page.title();
                        const htmlSnippet = await page.evaluate(() => document.body.innerText.substring(0, 500));
                        log.error('FAIL: 0 links found. Title: ' + title + ' Snippet: ' + htmlSnippet);
                    }
                    
                    for (const link of uniqueLinks) {
                        await context.enqueueRequest({ 
                            url: link, 
                            userData: { label: 'DETAIL', retailer } 
                        });
                    }
                } else {
                    log.info('DETAIL PAGE: ' + request.url);
                    
                    // Wait for initial load
                    await new Promise(r => setTimeout(r, 5000));
                    
                    const extraction = await page.evaluate((ret) => {
                        const titleSelectors = [
                            'h1.product-details-tile__title',
                            'h1.product-details-page__title',
                            '[data-testid="product-title"]',
                            'main h1',
                            '.product-details-page h1'
                        ];
                        
                        let name = '';
                        for (const sel of titleSelectors) {
                            const el = document.querySelector(sel);
                            if (el && el.innerText.trim().toLowerCase() !== 'back' && el.innerText.trim().length > 2) {
                                name = el.innerText.trim();
                                break;
                            }
                        }

                        const results = { 
                            url: window.location.href, 
                            retailer: ret, 
                            product: name || document.title.replace(/ - Tesco Groceries$/i, '').trim(), 
                            reviews: 0, 
                            image_url: '', 
                            price_display: 'N/A',
                            date_found: new Date().toISOString()
                        };
                        
                        // Price extraction
                        const priceEl = document.querySelector('.price-per-basket-unit, .price-details--unit-price, .value, [data-testid="product-price"], .ddsweb-price__text');
                        if (priceEl) results.price_display = priceEl.innerText.trim();
                        
                        if (results.price_display === 'N/A') {
                           const allP = Array.from(document.querySelectorAll('p, span'));
                           const pMatch = allP.find(p => p.innerText.includes('£'));
                           if (pMatch) results.price_display = pMatch.innerText.trim();
                        }

                        // LD+JSON for reviews and images
                        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
                        for (const s of scripts) {
                            try {
                                const json = JSON.parse(s.innerText);
                                const products = Array.isArray(json) ? json : [json];
                                const p = products.find(i => i['@type'] === 'Product');
                                if (p) {
                                    if (!results.product || results.product.toLowerCase() === 'back') {
                                        results.product = p.name;
                                    }
                                    if (p.aggregateRating) results.reviews = parseInt(p.aggregateRating.reviewCount) || 0;
                                    if (p.image) {
                                        results.image_url = typeof p.image === 'string' ? p.image : (Array.isArray(p.image) ? p.image[0] : (p.image.url || ''));
                                    }
                                }
                            } catch(e) {}
                        }
                        
                        // Fallback image
                        if (!results.image_url) {
                            const img = document.querySelector('.product-image img, .product-details-tile__image-container img');
                            if (img) results.image_url = img.src;
                        }
                        
                        // Manufacturer
                        const headers = Array.from(document.querySelectorAll('h3, strong'));
                        const mfnEl = headers.find(h => h.innerText.toLowerCase().includes('manufacturer'));
                        if (mfnEl && mfnEl.nextElementSibling) {
                            results.manufacturer_address = mfnEl.nextElementSibling.innerText.trim();
                        }

                        return results;
                    }, retailer);
                    
                    const isOwnBrand = extraction.product.toLowerCase().includes('tesco') || extraction.product.toLowerCase().includes('finest');
                    if (isOwnBrand) {
                        log.info('Skipping Own Brand: ' + extraction.product);
                        return null;
                    }
                    
                    log.info('Extracted: ' + extraction.product + ' (' + extraction.price_display + ')');
                    return extraction;
                }
            }`
        });
        
        console.log('Scrape started! Run ID:', run.id);
        console.log('View progress at:', `https://console.apify.com/view/runs/${run.id}`);
        return run.id;
    } catch (e) {
        console.error('Trigger Error:', e);
    }
}

triggerManualTesco();
