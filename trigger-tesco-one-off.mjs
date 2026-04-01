
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

const pageFunctionStr = `async function pageFunction(context) {
                const { page, request, log, enqueueLinks } = context;
                const { label, retailer } = request.userData;
                
                if (label === 'LISTING') {
                    log.info('Listing page (' + retailer + '): ' + request.url);
                    
                    // 1. Handle Overlays (Cookie Banners) FIRST
                    try {
                        const cookieSelector = '#onetrust-accept-btn-handler, #onetrust-banner-sdk button, #truste-consent-button';
                        const cookieBtn = await page.$(cookieSelector);
                        if (cookieBtn) {
                            log.info('Accepting cookie banner...');
                            await cookieBtn.click();
                            await new Promise(r => setTimeout(r, 4000));
                        }
                    } catch (e) {
                        log.debug('No cookie banner or error clicking it');
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
                    // 1. Force desktop viewport for all Puppeteer retailers
                    log.info('Setting desktop viewport...');
                    await page.setViewport({ width: 1920, height: 1080 });

                    const selectors = {
                        'Holland & Barrett': 'a[href*="/shop/product/"]',
                        'Sephora': 'a.product-link',
                        'Boots': 'a.oct-teaser-wrapper-link, a.oct-teaser__title-link',
                        'Waitrose': 'a[href*="/ecom/products/"]',
                        'Ocado': 'a[href*="/products/"]',
                        'Morrisons': 'a[href*="/products/"]:not([href*="onetrust"])',
                        'Sainsburys': '.pt__link, a[href*="/gol-ui/product/"], a[href*="/product/"]',
                        'Tesco': 'a[href*="/products/"], a[class*="titleLink"]',
                        'Asda': 'a[href*="/product/"], a.chakra-link, .co-product a',
                        'Superdrug': 'a.cx-product-name, a.product-image-container'
                    };

                    const nextSelectors = {
                        'Sainsburys': 'a[aria-label="Next page"]',
                        'Tesco': 'a.pagination--button--next, a[aria-label="Go to next page"]',
                        'Waitrose': 'a[aria-label="Next page"]',
                        'Morrisons': 'a.next-page, a[aria-label*="Next"]',
                        'Ocado': 'a.next-page',
                        'Asda': 'a[aria-label="Next page"], button[aria-label="Next page"], .co-pagination__next'
                    };
                    
                    const selector = selectors[retailer] || 'a[href*="/product/"], a[href*="/p/"]';

                    // 2. Accept Cookies immediately
                    try {
                        const cookieSelectors = ['#onetrust-accept-btn-handler', '#sp-cc-accept', 'button#onetrust-accept-btn-handler', 'button.accept-all'];
                        for (const sel of cookieSelectors) {
                            const btn = await page.$(sel);
                            if (btn) {
                                await btn.click();
                                await new Promise(r => setTimeout(r, 2000));
                                break; 
                            }
                        }
                    } catch (e) {}

                    // 3. Humanized Scrolling to trigger JS hydration
                    log.info('Scrolling to trigger lazy-loading...');
                    await page.evaluate(async (retailer) => {
                        const isSainsburys = retailer === 'Sainsburys';
                        const isAsda = retailer === 'Asda';
                        const isMorrisons = retailer === 'Morrisons';
                        
                        if (isMorrisons) {
                            if (document.body) {
                                document.body.style.minWidth = '1920px';
                                document.body.style.width = '1920px';
                            }
                        }
                        
                        const waitForProducts = () => {
                            return new Promise((resolve) => {
                                const check = () => {
                                    const products = document.querySelectorAll('a[href*="/products/"]:not([href*="onetrust"])');
                                    if (products.length > 0) resolve();
                                    else setTimeout(check, 500);
                                };
                                check();
                                setTimeout(resolve, 10000);
                            });
                        };
                        
                        if (isMorrisons || isAsda) {
                            await waitForProducts();
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
                                        if (currentHeight === lastHeight) {
                                            noChangeCount++;
                                        } else {
                                            noChangeCount = 0;
                                            lastHeight = currentHeight;
                                        }
                                    }
                                    
                                    if (noChangeCount > 80 || totalScrolls > 600) {
                                        clearInterval(scrollInterval);
                                        resolve();
                                    }
                                }, 250);
                            });
                        } else {
                            const scrolls = isSainsburys ? 15 : 10;
                            const distance = 800; 
                            for (let i = 0; i < scrolls; i++) {
                                window.scrollBy(0, distance);
                                const waitTime = isSainsburys ? (2000 + Math.random() * 2000) : 1500;
                                await new Promise(r => setTimeout(r, waitTime));
                            }
                        }
                    }, retailer);

                    // 4. Robust Wait for links and hydration
                    try {
                        const waitTimeout = retailer === 'Sainsburys' ? 75000 : (retailer === 'Asda' ? 60000 : 30000);
                        await page.waitForSelector(selector, { timeout: waitTimeout });
                        
                        if (retailer === 'Asda' || retailer === 'Sainsburys' || retailer === 'Morrisons') {
                            log.info('Waiting for product count to stabilize...');
                            await new Promise(r => setTimeout(r, 12000));
                        }
                    } catch (e) {
                        log.warning('Timeout or limited results during wait for ' + selector + ' on ' + request.url);
                    }

                    // 5. Enqueue product links manually for better reliability
                    const productLinks = await page.evaluate((sel) => {
                        return Array.from(document.querySelectorAll(sel))
                            .map(a => a.href)
                            .filter(href => href && (href.includes('/product') || href.includes('/p/')));
                    }, selector);

                    log.info('Found ' + productLinks.length + ' validated product links for ' + retailer);
                    
                    for (const link of productLinks) {
                        await context.enqueueRequest({
                            url: link,
                            userData: { 
                                retailer: retailer,
                                label: 'DETAIL'
                            }
                        });
                    }

                    // 6. Discover and Enqueue Next Page
                    const nextSelector = nextSelectors[retailer];
                    if (nextSelector) {
                        const nextUrl = await page.evaluate((sel, ret) => {
                            const el = document.querySelector(sel);
                            if (!el) return null;
                            
                            if (ret === 'Asda') {
                                if (el.tagName === 'A' && el.href) return el.href;
                                
                                const currentUrl = new URL(window.location.href);
                                const pageNum = parseInt(currentUrl.searchParams.get('page') || '1');
                                currentUrl.searchParams.set('page', (pageNum + 1).toString());
                                return currentUrl.toString();
                            }
                            
                            return el.href || null;
                        }, nextSelector, retailer);

                        if (nextUrl) {
                            log.info('Next page discovered for ' + retailer + ': ' + nextUrl);
                            await context.enqueueRequest({
                                url: nextUrl,
                                userData: { 
                                    retailer: retailer, 
                                    label: 'LISTING' 
                                }
                            });
                        }
                    }
                } else {
                    log.info('Product page (' + retailer + '): ' + request.url);
                    
                    // RANDOM DELAY on detail page to bypass Tesco/Security "Oops" redirects
                    const randomWait = 3000 + (Math.random() * 5000);
                    log.info('Humanized detail-page delay: ' + Math.round(randomWait) + 'ms');
                    await new Promise(r => setTimeout(r, randomWait));
                    
                    const extractionData = await page.evaluate((retailer) => {
                        let name = document.title;
                        const h1 = document.querySelector('h1');
                        if (h1 && h1.innerText && h1.innerText.length > 5 && h1.innerText.toLowerCase() !== 'error') {
                            name = Array.from(h1.childNodes)
                                .map(node => node.textContent.trim())
                                .filter(t => t.length > 0)
                                .join(' ');
                        } else {
                            const ogTitle = document.querySelector('meta[property="og:title"]');
                            if (ogTitle && ogTitle.content) name = ogTitle.content;
                        }
                        
                        name = name.replace(/ - Tesco Groceries$/i, '')
                                   .replace(/ | Boots$/i, '')
                                   .replace(/ | Sephora/i, '')
                                   .replace(/ - Asda Groceries$/i, '')
                                   .trim();

                        const results = { url: window.location.href, retailer: retailer, name: name, reviews: 0, image: '' };
                        
                        if (name.toLowerCase() === 'error' || name.toLowerCase().includes('access denied') || name.toLowerCase().includes('page not found') || name.toLowerCase().includes('oops')) {
                            results.status = 'Blocked/Error';
                        }
                        
                        if (retailer === 'Waitrose') {
                            const pageText = document.body.innerText.toLowerCase();
                            if (pageText.includes('waitrose own label') || name.toLowerCase().includes('waitrose')) {
                                results.status = 'Own Brand';
                            }
                        }

                        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
                        for (const s of scripts) {
                            try {
                                const json = JSON.parse(s.innerText);
                                const products = Array.isArray(json) ? json : [json];
                                const product = products.find(i => i['@type'] === 'Product' || (i['@graph'] && i['@graph'].find(g => g['@type'] === 'Product')));
                                const p = product && product['@graph'] ? product['@graph'].find(g => g['@type'] === 'Product') : product;
                                if (p) {
                                    if (p.aggregateRating) {
                                        results.reviews = parseInt(p.aggregateRating.reviewCount || p.aggregateRating.numberOfReviews) || 0;
                                    }
                                    if (p.image) {
                                        results.image = typeof p.image === 'string' ? p.image : (p.image.url || (Array.isArray(p.image) ? p.image[0] : ''));
                                    }
                                }
                            } catch(e) {}
                        }
                        
                        if (!results.image) {
                            const ogImage = document.querySelector('meta[property="og:image"]');
                            if (ogImage) results.image = ogImage.getAttribute('content');
                        }
                        
                        if (!results.image) {
                            const imgSelectors = [
                                '.pt-image__image', // Sainsbury's
                                'img[itemprop="image"]',
                                '.product-image img',
                                '.oct-teaser__image',
                                '#main-product-image',
                                '.co-product-image img'
                            ];
                            for (const sel of imgSelectors) {
                                const img = document.querySelector(sel);
                                if (img && img.src) {
                                    results.image = img.src;
                                    break;
                                }
                            }
                        }

                        if (results.reviews === 0) {
                            const bvCount = document.querySelector('.bv_numReviews_text, #bvRContainer-Link, [data-bv-show="rating_summary"]');
                            if (bvCount) results.reviews = parseInt(bvCount.innerText.replace(/[^0-9]/g, '')) || 0;
                        }
                        if (results.reviews === 0 && retailer === 'Sainsburys') {
                            const ratingStars = document.querySelector('.ds-c-rating__stars, .star-rating-link');
                            if (ratingStars && ratingStars.getAttribute('aria-label')) {
                                const match = ratingStars.getAttribute('aria-label').match(/from\\s+(\\d+)\\s+reviews/i) || ratingStars.getAttribute('aria-label').match(/(\\d+)\\s+reviews/i);
                                if (match) results.reviews = parseInt(match[1]) || 0;
                            }
                        }

                        // Extract Manufacturer Address Block specifically for Sainsbury's, Tesco, & others
                        let addressText = '';
                        const mfnHeaders = Array.from(document.querySelectorAll('h3, strong, span, div, summary'))
                            .filter(el => {
                                const t = el.innerText ? el.innerText.toLowerCase().trim() : '';
                                return t === 'manufacturer address' || t === 'manufacturer' || t === 'return to' || t === 'manufacturer details' || t === 'brand details';
                            });
                            
                        for (const el of mfnHeaders) {
                            let text = el.nextElementSibling ? el.nextElementSibling.innerText : '';
                            if (!text && el.parentElement) {
                                text = el.parentElement.innerText.replace(el.innerText, '');
                            }
                            if (text && text.length > 5 && text.length < 1000) {
                                addressText += ' ' + text;
                            }
                        }

                        if (retailer === 'Holland & Barrett' && !addressText) {
                            const descParagraphs = Array.from(document.querySelectorAll('div[data-testid="content-tabs-description"] p, section[aria-label="Description"] p'));
                            if (descParagraphs.length > 0) {
                                const lastP = descParagraphs[descParagraphs.length - 1].innerText;
                                if (lastP && lastP.length < 300) {
                                    addressText += ' ' + lastP;
                                }
                            }
                        }

                        results.manufacturer_address = addressText.trim().replace(/\\n/g, ' ');

                        const ownBrandKeywords = [
                            'Asda', 'Extra Special', 'Sainsburys', 'Sainsbury\\'s', 'Taste the Difference', 'By Sainsbury\\'s',
                            'Waitrose', 'Essential Waitrose', 'Waitrose No.1', 'Tesco', 'Tesco Finest', 'Morrisons', 'The Best',
                            'Ocado', 'Boots', 'Superdrug', 'H&B', 'Holland & Barrett', 'Sephora'
                        ];
                        
                        results.isOwnBrand = ownBrandKeywords.some(kw => results.name.toLowerCase().includes(kw.toLowerCase()));
                        
                        if (retailer === 'Sainsburys' && (results.name.toLowerCase().includes('habitat') || window.location.href.toLowerCase().includes('habitat'))) {
                            results.isHabitat = true;
                        }

                        if (retailer === 'Tesco') {
                            const isMarketplace = Array.from(document.querySelectorAll('a, span, div, li')).some(el => {
                                const t = el.innerText ? el.innerText.trim().toLowerCase() : '';
                                return t === 'marketplace' || t.includes('sold and shipped by') || t.includes('sold and dispatched by');
                            });
                            
                            if (isMarketplace || window.location.href.toLowerCase().includes('marketplace') || document.body.innerText.toLowerCase().includes('sold and shipped by')) {
                                results.isMarketplace = true;
                            }
                        }

                        return results;
                    }, retailer);

                    if (extractionData.isMarketplace) {
                        log.info('Skipping Tesco Marketplace product: ' + extractionData.name);
                        return null;
                    }
                    if (extractionData.isHabitat) {
                        log.info('Skipping Habitat product: ' + extractionData.name);
                        return null;
                    }
                    if (extractionData.isOwnBrand) {
                        log.info('Skipping Own Brand: ' + extractionData.name);
                        return null;
                    }
                    if (extractionData.reviews > 5) {
                        log.info('Skipping High Reviews (' + extractionData.reviews + '): ' + extractionData.name);
                        return null;
                    }

                    if (extractionData.status === 'Blocked/Error' || extractionData.name.toLowerCase().includes('oops') || extractionData.name.toLowerCase().includes('went wrong')) {
                        log.info('Skipping error page: ' + extractionData.name);
                        return null;
                    }
                    
                    return extractionData;
                }
            }`;

async function triggerTescoScrape() {
    const startUrls = [
        { url: 'https://www.tesco.com/shop/en-GB/buylists/new-ranges/new-frozen-and-fresh-food?count=24&page=2#top', userData: { retailer: 'Tesco', label: 'LISTING' } },
        { url: 'https://www.tesco.com/shop/en-GB/buylists/new-ranges/new-frozen-and-fresh-food?count=24&page=3#top', userData: { retailer: 'Tesco', label: 'LISTING' } },
        { url: 'https://www.tesco.com/shop/en-GB/buylists/new-ranges/new-frozen-and-fresh-food?count=24&page=4#top', userData: { retailer: 'Tesco', label: 'LISTING' } }
    ];

    console.log('Triggering Tesco scrape for:', startUrls[0].url);

    try {
        const run = await client.actor('apify/puppeteer-scraper').start({
            startUrls,
            useChrome: true,
            useStealth: true,
            stealth: true,
            maxPagesPerCrawl: 50,
            proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'], countryCode: 'GB' },
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            pageFunction: pageFunctionStr,
            timeoutSecs: 1800,
            pageFunctionTimeoutSecs: 180,
            requestHandlerTimeoutSecs: 180,
            navigationTimeoutSecs: 60
        });

        console.log('Scrape started! Run ID:', run.id);
        console.log('View run at:', `https://console.apify.com/view/runs/${run.id}`);
    } catch (error) {
        console.error('Error triggering scrape:', error);
    }
}

triggerTescoScrape();
