import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const APIFY_TOKEN = process.env.APIFY_TOKEN;

if (!APIFY_TOKEN) {
    console.error('Missing APIFY_TOKEN!');
    process.exit(1);
}

const client = new ApifyClient({ token: APIFY_TOKEN });

const startUrls = [
    { url: 'https://www.sainsburys.co.uk/gol-ui/features/newfoodcupboard', userData: { retailer: 'Sainsburys', label: 'LISTING' } },
    { url: 'https://groceries.morrisons.com/categories/fresh-chilled-foods/176739?boolean=new&sortBy=favorite', userData: { retailer: 'Morrisons', label: 'LISTING' } }
];

async function triggerScrape() {
    console.log('--- Triggering Custom Scrape ---');
    startUrls.forEach(u => console.log(` - ${u.url} (${u.userData.retailer})`));

    try {
        const run = await client.actor('apify/puppeteer-scraper').start({
            startUrls,
            useChrome: true,
            stealth: true,
            maxPagesPerCrawl: 100,
            proxyConfiguration: { 
                useApifyProxy: true, 
                apifyProxyGroups: ['RESIDENTIAL'], 
                countryCode: 'GB' 
            },
            pageFunction: `async function pageFunction(context) {
                const { page, request, log, enqueueLinks } = context;
                const { label, retailer } = request.userData;
                
                if (label === 'LISTING') {
                    log.info('Listing page (' + retailer + '): ' + request.url);
                    
                    // 1. Handle Overlays (Cookie Banners)
                    try {
                        const cookieSelector = '#onetrust-accept-btn-handler, #onetrust-banner-sdk button, #truste-consent-button';
                        const cookieBtn = await page.$(cookieSelector);
                        if (cookieBtn) {
                            log.info('Accepting cookie banner to reveal content...');
                            await cookieBtn.click();
                            await new Promise(r => setTimeout(r, 4000));
                        }
                    } catch (e) {
                        log.debug('No cookie banner or error handling it');
                    }

                    // 2. DETECT BLOCKS on Listing Page
                    const pageTitle = await page.title();
                    const bodyText = (await page.evaluate(() => document.body ? document.body.innerText : '')).toLowerCase();
                    
                    if (pageTitle.toLowerCase().includes('access denied') || 
                        pageTitle.toLowerCase().includes('site load error') ||
                        pageTitle.toLowerCase().includes('just a moment') ||
                        pageTitle.toLowerCase().includes('attention required') ||
                        bodyText.includes('access denied') ||
                        bodyText.includes('access to this page has been denied')) {
                        log.error('Access Denied or Challenge on Listing Page! URL: ' + request.url + ' Title: ' + pageTitle);
                        return;
                    }

                    log.info('Setting desktop viewport...');
                    await page.setViewport({ width: 1920, height: 1080 });

                    const selectors = {
                        'Morrisons': 'a[href*="/products/"]:not([href*="onetrust"])',
                        'Sainsburys': '.pt__link, a[href*="/gol-ui/product/"], a[href*="/product/"]'
                    };
                    
                    const selector = selectors[retailer] || 'a[href*="/product/"], a[href*="/p/"]';

                    // 3. Humanized Scrolling
                    log.info('Scrolling to trigger lazy-loading...');
                    await page.evaluate(async (retailer) => {
                        const isSainsburys = retailer === 'Sainsburys';
                        const isMorrisons = retailer === 'Morrisons';
                        
                        if (isMorrisons) {
                            if (document.body) {
                                document.body.style.minWidth = '1920px';
                                document.body.style.width = '1920px';
                            }

                            // Wait for products
                            await new Promise((resolve) => {
                                const check = () => {
                                    const products = document.querySelectorAll('a[href*="/products/"]:not([href*="onetrust"])');
                                    if (products.length > 0) resolve();
                                    else setTimeout(check, 500);
                                };
                                check();
                                setTimeout(resolve, 10000);
                            });

                            // Robust scroll
                            await new Promise((resolve) => {
                                let lastHeight = document.body.scrollHeight;
                                let noChangeCount = 0;
                                let totalScrolls = 0;
                                const scrollInterval = setInterval(async () => {
                                    window.scrollBy(0, 500);
                                    totalScrolls++;
                                    const currentHeight = document.body.scrollHeight;
                                    const scrolledToBottom = (window.innerHeight + window.scrollY) >= (currentHeight - 200);
                                    if (scrolledToBottom) {
                                        if (currentHeight === lastHeight) noChangeCount++;
                                        else { noChangeCount = 0; lastHeight = currentHeight; }
                                    }
                                    if (noChangeCount > 80 || totalScrolls > 600) {
                                        clearInterval(scrollInterval);
                                        resolve();
                                    }
                                }, 250);
                            });
                        } else {
                            const scrolls = isSainsburys ? 15 : 10;
                            for (let i = 0; i < scrolls; i++) {
                                window.scrollBy(0, 800);
                                await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));
                            }
                        }
                    }, retailer);

                    // 4. Wait for stability
                    try {
                        const waitTimeout = retailer === 'Sainsburys' ? 75000 : 60000;
                        await page.waitForSelector(selector, { timeout: waitTimeout });
                        await new Promise(r => setTimeout(r, 15000));
                    } catch (e) {
                        log.warning('Timeout or limited results during wait on ' + request.url);
                    }

                    // 5. Enqueue product links
                    const productLinks = await page.evaluate((sel, ret) => {
                        return Array.from(document.querySelectorAll(sel))
                            .map(a => a.href)
                            .filter(href => {
                                if (!href || href.includes('onetrust')) return false;
                                try {
                                    const urlObj = new URL(href);
                                    return urlObj.hostname.includes(ret.toLowerCase().replace('sainsburys', 'sainsbury').replace(' ', '')) || urlObj.hostname.includes('morrisons.com');
                                } catch (e) { return false; }
                            });
                    }, selector, retailer);

                    log.info('Found ' + productLinks.length + ' validated product links for ' + retailer);
                    
                    for (const link of productLinks) {
                        await context.enqueueRequest({
                            url: link,
                            userData: { retailer, label: 'DETAIL' }
                        });
                    }
                } else {
                    log.info('Product page (' + retailer + '): ' + request.url);
                    await new Promise(r => setTimeout(r, 8000));
                    
                    const extractionData = await page.evaluate((retailer) => {
                        let name = document.title;
                        const h1 = document.querySelector('h1');
                        if (h1 && h1.innerText && h1.innerText.length > 5 && h1.innerText.toLowerCase() !== 'error') {
                            name = Array.from(h1.childNodes).map(node => node.textContent.trim()).filter(t => t.length > 0).join(' ');
                        }
                        
                        name = name.replace(/ - Morrisons$/i, '').replace(/ - Sainsburys$/i, '').trim();

                        const results = { url: window.location.href, retailer: retailer, name: name, reviews: 0, image: '' };
                        
                        if (name.toLowerCase() === 'error' || name.toLowerCase().includes('access denied')) results.status = 'Blocked/Error';
                        
                        // Extract Reviews and Image from LD+JSON
                        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
                        for (const s of scripts) {
                            try {
                                const json = JSON.parse(s.innerText);
                                const products = Array.isArray(json) ? json : [json];
                                const p = products.find(i => i['@type'] === 'Product' || (i['@graph'] && i['@graph'].find(g => g['@type'] === 'Product')));
                                if (p) {
                                    const actualP = p['@graph'] ? p['@graph'].find(g => g['@type'] === 'Product') : p;
                                    if (actualP.aggregateRating) results.reviews = parseInt(actualP.aggregateRating.reviewCount || actualP.aggregateRating.numberOfReviews) || 0;
                                    if (actualP.image) results.image = typeof actualP.image === 'string' ? actualP.image : (actualP.image.url || (Array.isArray(actualP.image) ? actualP.image[0] : ''));
                                }
                            } catch(e) {}
                        }
                        
                        // Fallback Image
                        if (!results.image) {
                            const ogImage = document.querySelector('meta[property="og:image"]');
                            if (ogImage) results.image = ogImage.getAttribute('content');
                        }

                        // Extract Manufacturer/Brand details
                        let addressText = '';
                        const mfnHeaders = Array.from(document.querySelectorAll('h3, strong, span, div, summary'))
                            .filter(el => {
                                const t = el.innerText ? el.innerText.toLowerCase().trim() : '';
                                return t === 'manufacturer address' || t === 'manufacturer' || t === 'return to' || t === 'brand details';
                            });
                        for (const el of mfnHeaders) {
                            let text = el.nextElementSibling ? el.nextElementSibling.innerText : (el.parentElement ? el.parentElement.innerText.replace(el.innerText, '') : '');
                            if (text && text.length > 5 && text.length < 1000) addressText += ' ' + text;
                        }
                        results.manufacturer_address = addressText.trim().replace(/\\n/g, ' ');

                        // Filtering
                        const ownBrandKeywords = ['Asda', 'Sainsburys', 'Sainsbury\\'s', 'Morrisons', 'The Best', 'Taste the Difference'];
                        results.isOwnBrand = ownBrandKeywords.some(kw => results.name.toLowerCase().includes(kw.toLowerCase()));
                        
                        return results;
                    }, retailer);

                    if (extractionData.isOwnBrand) {
                        log.info('Skipping Own Brand: ' + extractionData.name);
                        return null;
                    }
                    if (extractionData.reviews > 5) {
                        log.info('Skipping High Reviews (' + extractionData.reviews + '): ' + extractionData.name);
                        return null;
                    }
                    
                    return extractionData;
                }
            }`,
            timeoutSecs: 3600,
            pageFunctionTimeoutSecs: 300,
        });

        console.log(`Run started: ${run.id}`);
        console.log(`View progress: https://console.apify.com/actors/apify/puppeteer-scraper/runs/${run.id}`);
        
    } catch (error) {
        console.error('Trigger failed:', error);
    }
}

triggerScrape();
