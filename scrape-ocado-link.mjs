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
    { url: 'https://www.ocado.com/categories/food-cupboard/tinned-canned/3b3c1620-f2ed-4518-8f92-75c3c3e3954d?boolean=new&sortBy=favorite', userData: { retailer: 'Ocado', label: 'LISTING' } }
];

async function triggerScrape() {
    console.log('--- Triggering Ocado Scrape ---');
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
                        const cookieSelector = '#onetrust-accept-btn-handler, #onetrust-banner-sdk button, #truste-consent-button, .sp-cc-accept-button';
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

                    const selector = 'a[href*="/products/"]';

                    // 3. Humanized Scrolling
                    log.info('Scrolling to trigger lazy-loading...');
                    await page.evaluate(async () => {
                        const scrolls = 10;
                        for (let i = 0; i < scrolls; i++) {
                            window.scrollBy(0, 800);
                            await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));
                        }
                    });

                    // 4. Wait for stability
                    try {
                        const waitTimeout = 60000;
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
                                    return urlObj.hostname.includes('ocado.com');
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
                        
                        name = name.replace(/ - Ocado$/i, '').trim();

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
                        const ownBrandKeywords = ['Ocado', 'Marks & Spencer', 'M&S'];
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
            timeoutSecs: 1800,
            pageFunctionTimeoutSecs: 180,
        });

        console.log(`Run started: ${run.id}`);
        console.log(`View progress: https://console.apify.com/actors/apify/puppeteer-scraper/runs/${run.id}`);
        
    } catch (error) {
        console.error('Trigger failed:', error);
    }
}

triggerScrape();
