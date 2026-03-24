import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';

dotenv.config();

const execPromise = promisify(exec);
const APIFY_TOKEN = process.env.APIFY_TOKEN;

if (!APIFY_TOKEN) {
    console.error('Missing APIFY_TOKEN!');
    process.exit(1);
}

const client = new ApifyClient({ token: APIFY_TOKEN });
const targetUrl = 'https://www.asda.com/groceries/event/new-food-cupboard';

async function triggerScrape() {
    console.log(`Triggering one-off Asda scrape for: ${targetUrl}`);

    try {
        const run = await client.actor('apify/puppeteer-scraper').start({
            startUrls: [{ url: targetUrl, userData: { retailer: 'Asda', label: 'LISTING' } }],
            useChrome: true,
            stealth: true,
            maxPagesPerCrawl: 100,
            proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'], countryCode: 'GB' },
            pageFunction: `async function pageFunction(context) {
                const { page, request, log, enqueueLinks } = context;
                const { label, retailer } = request.userData;
                const url = request.url;

                if (label === 'LISTING') {
                    log.info('Listing page (' + retailer + '): ' + url);
                    
                    // 1. Force desktop viewport
                    await page.setViewport({ width: 1920, height: 1080 });

                    // 2. Accept Cookies
                    try {
                        const cookieSelectors = ['#onetrust-accept-btn-handler', '#sp-cc-accept', 'button.accept-all'];
                        for (const sel of cookieSelectors) {
                            const btn = await page.$(sel);
                            if (btn) {
                                await btn.click();
                                await new Promise(r => setTimeout(r, 2000));
                                break; 
                            }
                        }
                    } catch (e) {}

                    // 3. Robust Dynamic Scroll
                    await page.evaluate(async () => {
                        await new Promise((resolve) => {
                            let totalHeight = 0;
                            let distance = 500;
                            let timer = setInterval(() => {
                                let scrollHeight = document.body.scrollHeight;
                                window.scrollBy(0, distance);
                                totalHeight += distance;
                                if (totalHeight >= scrollHeight || totalHeight > 10000) {
                                    clearInterval(timer);
                                    resolve();
                                }
                            }, 200);
                        });
                    });

                    // 4. Wait for products
                    const selector = 'a[href*="/product/"], a.chakra-link, .co-product a';
                    try {
                        await page.waitForSelector(selector, { timeout: 30000 });
                        await new Promise(r => setTimeout(r, 5000));
                    } catch (e) {
                        log.warning('Timeout waiting for products: ' + e.message);
                    }

                    // 5. Enqueue product links
                    const productLinks = await page.evaluate((sel) => {
                        return Array.from(document.querySelectorAll(sel))
                            .map(a => a.href)
                            .filter(href => href && href.includes('/product/'))
                            .filter((value, index, self) => self.indexOf(value) === index);
                    }, selector);

                    log.info('Found ' + productLinks.length + ' product links');
                    
                    for (const link of productLinks) {
                        await context.enqueueRequest({
                            url: link,
                            userData: { retailer, label: 'DETAIL' }
                        });
                    }
                } else {
                    log.info('Product page (' + retailer + '): ' + url);
                    await new Promise(r => setTimeout(r, 5000));
                    
                    const extractionData = await page.evaluate((retailer) => {
                        let name = document.title;
                        const h1 = document.querySelector('h1');
                        if (h1 && h1.innerText) {
                            name = h1.innerText.trim();
                        }
                        
                        name = name.replace(/ - Asda Groceries$/i, '').trim();

                        const results = { url: window.location.href, retailer: retailer, name: name, reviews: 0, image: '' };
                        
                        // Extract Brand
                        const brandEl = document.querySelector('.pdp-main-details__brand, .pdp-brand-logo img');
                        if (brandEl) {
                            results.brand = brandEl.alt || brandEl.innerText || '';
                        }

                        // JSON-LD
                        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
                        for (const s of scripts) {
                            try {
                                const json = JSON.parse(s.innerText);
                                const product = Array.isArray(json) ? json.find(i => i['@type'] === 'Product') : (json['@type'] === 'Product' ? json : (json['@graph'] ? json['@graph'].find(g => g['@type'] === 'Product') : null));
                                if (product) {
                                    if (product.aggregateRating) {
                                        results.reviews = parseInt(product.aggregateRating.reviewCount || product.aggregateRating.numberOfReviews) || 0;
                                    }
                                    if (product.image) {
                                        results.image = typeof product.image === 'string' ? product.image : (product.image.url || (Array.isArray(product.image) ? product.image[0] : ''));
                                    }
                                    if (product.brand && product.brand.name) {
                                        results.brand = product.brand.name;
                                    }
                                    if (product.offers && product.offers.price) {
                                        results.price = product.offers.price;
                                    }
                                }
                            } catch(e) {}
                        }
                        
                        if (!results.image) {
                            const img = document.querySelector('.co-product-image img, .pdp-main-details__image img');
                            if (img) results.image = img.src;
                        }

                        return results;
                    }, retailer);
                    
                    return extractionData;
                }
            }`,
            timeoutSecs: 3600
        });

        console.log(`\nRun started: ${run.id}`);
        console.log(`View progress: https://console.apify.com/actors/apify/puppeteer-scraper/runs/${run.id}`);
        
        console.log('Waiting for run to finish...');
        let finishedRun = await client.run(run.id).waitForFinish();
        
        if (finishedRun.status === 'SUCCEEDED') {
            console.log('\nScrape SUCCEEDED! Triggering sync to sheet...');
            const { stdout, stderr } = await execPromise(`node sync-run-to-sheet.mjs ${run.id}`);
            console.log(stdout);
            if (stderr) console.error(stderr);
        } else {
            console.error(`Scrape finished with status: ${finishedRun.status}`);
        }
        
    } catch (error) {
        console.error('Trigger failed:', error);
    }
}

triggerScrape();
