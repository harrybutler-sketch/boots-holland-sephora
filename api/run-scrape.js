import { ApifyClient } from 'apify-client';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).send('Method Not Allowed');
  }

  try {
    let body = request.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { /* ignore */ }
    }

    const { retailers, workspace } = body || {};
    console.log('--- Scrape Trigger Received (API) ---');
    console.log('Workspace:', workspace);
    console.log('Retailers:', retailers);

    if (!retailers || !Array.isArray(retailers) || retailers.length === 0) {
      return response.status(400).json({ error: 'Retailers list is required', debug: { body } });
    }

    if (!process.env.APIFY_TOKEN) {
      return response.status(500).json({ error: 'APIFY_TOKEN is missing' });
    }

    const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

    // 1. Defined eCommerce Scraper Retailers ("The Big 4")
    const ecommerceMap = {};

    const groceryUrls = {
      'Tesco': 'https://www.tesco.com/groceries/en-GB/shop/food-cupboard/all?sortBy=relevance&page=5&facetsArgs=new%3Atrue&count=24#top',
      'Asda': 'https://groceries.asda.com/search/new%20in\nhttps://groceries.asda.com/shelf/new-in/1215685911554'
    };

    // 2. Categorize
    const ecommerceRetailersToScrape = [];
    const puppeteerRetailersToScrape = [];

    retailers.forEach(r => {
      const cleanName = r.trim().toLowerCase();
      if (ecommerceMap[cleanName]) {
        ecommerceRetailersToScrape.push(r);
      } else {
        puppeteerRetailersToScrape.push(r);
      }
    });

    console.log('Routed to eCommerce Tool:', ecommerceRetailersToScrape);
    console.log('Routed to Puppeteer Scraper:', puppeteerRetailersToScrape);

    const host = request.headers.host || 'boots-holland-sephora.vercel.app';
    const webhookUrl = `https://${host}/api/run-status?workspace=${workspace || 'beauty'}`;
    const runs = [];

    // 3. Trigger eCommerce Scraper
    if (ecommerceRetailersToScrape.length > 0) {
      const inputUrls = [];
      ecommerceRetailersToScrape.forEach(r => {
        const stdName = ecommerceMap[r.trim().toLowerCase()];
        if (stdName === 'Superdrug') {
          inputUrls.push('https://www.superdrug.com/new-in/c/new');
        } else if (groceryUrls[stdName]) {
          // Split by newline and add each URL
          groceryUrls[stdName].split('\n').filter(u => u.trim()).forEach(u => inputUrls.push(u.trim()));
        }
      });

      if (inputUrls.length > 0) {
        console.log('Starting eCommerce Scraper...');
        // Limit Tesco to 300 products as requested
        const maxItems = ecommerceRetailersToScrape.some(r => r.toLowerCase().includes('tesco')) ? 300 : 1000;

        const run = await client.actor('apify/e-commerce-scraping-tool').start({
          listingUrls: inputUrls.map(url => ({ url })),
          maxItems: maxItems,
          proxyConfiguration: { useApifyProxy: true },
          timeoutSecs: 1200
        }, {
          webhooks: [{ eventTypes: ['ACTOR.RUN.SUCCEEDED'], requestUrl: webhookUrl + '&source=ecommerce' }]
        });
        runs.push({ id: run.id, actor: 'e-commerce-scraping-tool', retailers: ecommerceRetailersToScrape });
      }
    }

    // 4. Trigger Puppeteer Scraper
    if (puppeteerRetailersToScrape.length > 0) {
      const startUrls = [];
      const pRetailers = puppeteerRetailersToScrape.map(r => r.toLowerCase().trim());

      if (pRetailers.some(r => r.includes('sephora'))) {
        startUrls.push({ url: 'https://www.sephora.co.uk/new-at-sephora', userData: { retailer: 'Sephora', label: 'LISTING' } });
      }
      if (pRetailers.some(r => r.includes('boots'))) {
        startUrls.push({ url: 'https://www.boots.com/new-to-boots', userData: { retailer: 'Boots', label: 'LISTING' } });
      }
      if (pRetailers.some(r => r.includes('holland'))) {
        startUrls.push({ url: 'https://www.hollandandbarrett.com/shop/health-wellness/?t=is_new%3Atrue', userData: { retailer: 'Holland & Barrett', label: 'LISTING' } });
        startUrls.push({ url: 'https://www.hollandandbarrett.com/shop/natural-beauty/natural-beauty-shop-all/?t=is_new%3Atrue', userData: { retailer: 'Holland & Barrett', label: 'LISTING' } });
      }
      if (pRetailers.some(r => r.includes('tesco'))) {
        const tescoUrls = [
          'https://www.tesco.com/groceries/en-GB/shop/food-cupboard/all?sortBy=relevance&facetsArgs=new%3Atrue&count=24',
          'https://www.tesco.com/groceries/en-GB/shop/frozen-food/all?sortBy=relevance&facetsArgs=new%3Atrue&count=24',
          'https://www.tesco.com/groceries/en-GB/shop/fresh-food/all?sortBy=relevance&facetsArgs=new%3Atrue&count=24',
          'https://www.tesco.com/groceries/en-GB/shop/drinks/all?sortBy=relevance&facetsArgs=new%3Atrue&count=24'
        ];
        tescoUrls.forEach(url => startUrls.push({ url, userData: { retailer: 'Tesco', label: 'LISTING' } }));
      }
      if (pRetailers.some(r => r.includes('sainsbury'))) {
        const sainsburyUrls = [
          'https://www.sainsburys.co.uk/gol-ui/features/new-in/other:new',
          'https://www.sainsburys.co.uk/gol-ui/features/newforsnacks',
          'https://www.sainsburys.co.uk/gol-ui/features/newdrinks',
          'https://www.sainsburys.co.uk/gol-ui/features/new-in-frozen',
          'https://www.sainsburys.co.uk/gol-ui/features/new-in-chilled'
        ];
        sainsburyUrls.forEach(url => startUrls.push({ url, userData: { retailer: 'Sainsburys', label: 'LISTING' } }));
      }
      if (pRetailers.some(r => r.includes('waitrose'))) {
        startUrls.push({ url: 'https://www.waitrose.com/ecom/shop/browse/groceries/new/drinks?srsltid=AfmBOooKM98Ui8176ymqqxOJPFOQXSyUlzCwkxv5jd3yb4VseBO_bBKu', userData: { retailer: 'Waitrose', label: 'LISTING' } });
      }
      if (pRetailers.some(r => r.includes('morrisons'))) {
        startUrls.push({ url: 'https://groceries.morrisons.com/categories/new/all-new/192781?srsltid=AfmBOoo-ONo2qwBeZl3L-4y-TYaHWAQRonE7GE-fBZHExT7sQvai2YZT', userData: { retailer: 'Morrisons', label: 'LISTING' } });
      }
      if (pRetailers.some(r => r.includes('ocado'))) {
        startUrls.push({ url: 'https://www.ocado.com/categories/new-trending/new/9c727c0b-e6d8-4e07-b6d9-5126e8c9ef9d?boolean=new&sortBy=favorite', userData: { retailer: 'Ocado', label: 'LISTING' } });
      }
      if (pRetailers.some(r => r.includes('asda'))) {
        startUrls.push({ url: 'https://groceries.asda.com/search/New%20in', userData: { retailer: 'Asda', label: 'LISTING' } });
      }
      if (pRetailers.some(r => r.includes('superdrug'))) {
        startUrls.push({ url: 'https://www.superdrug.com/new-in/c/new', userData: { retailer: 'Superdrug', label: 'LISTING' } });
      }

      if (startUrls.length > 0) {
        console.log('Starting Puppeteer Scraper...');
        const maxPages = 300; // Adjusted limit to 300 to balance cost and yield

        const run = await client.actor('apify/puppeteer-scraper').start({
          startUrls,
          useChrome: true,
          stealth: true,
          maxPagesPerCrawl: maxPages,
          proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'], countryCode: 'GB' },
          pageFunction: `async function pageFunction(context) {
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
                    if (pageTitle.toLowerCase().includes('access denied') || 
                        pageTitle.toLowerCase().includes('site load error') ||
                        pageTitle.toLowerCase().includes('just a moment') ||
                        pageTitle.toLowerCase().includes('attention required')) {
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
                        const cookieSelectors = ['#onetrust-accept-btn-handler', '#sp-cc-accept', 'button:contains("Accept")'];
                        for (const sel of cookieSelectors) {
                            if (await page.$(sel)) {
                                await page.click(sel);
                                await new Promise(r => setTimeout(r, 1000));
                            }
                        }
                    } catch (e) {}

                    // 3. Humanized Scrolling to trigger JS hydration
                    log.info('Scrolling to trigger lazy-loading...');
                    await page.evaluate(async (retailer) => {
                        const isSainsburys = retailer === 'Sainsburys';
                        const isAsda = retailer === 'Asda';
                        const isMorrisons = retailer === 'Morrisons';
                        
                        if (isMorrisons || isAsda) {
                            // Smooth continuous scrolling for React lazy-loaders
                            await new Promise((resolve) => {
                                let totalHeight = 0;
                                let distance = 300; // Scroll 300px at a time
                                let timer = setInterval(() => {
                                    let scrollHeight = document.body.scrollHeight;
                                    window.scrollBy(0, distance);
                                    totalHeight += distance;
                                    
                                    // Stop after scrolling down enough to trigger all products 
                                    if(totalHeight >= scrollHeight - window.innerHeight || totalHeight > 30000){
                                        clearInterval(timer);
                                        resolve();
                                    }
                                }, 150); // Every 150ms
                            });
                        } else {
                            // Block scrolling for simpler sites
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
                        const waitTimeout = (retailer === 'Sainsburys' || retailer === 'Asda') ? 60000 : 30000;
                        await page.waitForSelector(selector, { timeout: waitTimeout });
                        
                        // Extra Waiter for stability (prevent React re-renders from hiding new elements)
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
                    await new Promise(r => setTimeout(r, 8000));
                    
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
                                // Sometimes the header is inside a detail or div alongside the text
                                text = el.parentElement.innerText.replace(el.innerText, '');
                            }
                            if (text && text.length > 5 && text.length < 1000) {
                                addressText += ' ' + text;
                            }
                        }

                        // Specific Extraction for Holland & Barrett (since they put it at the bottom of the description)
                        if (retailer === 'Holland & Barrett' && !addressText) {
                            // Find all paragraphs in the description tabs/sections
                            const descParagraphs = Array.from(document.querySelectorAll('div[data-testid="content-tabs-description"] p, section[aria-label="Description"] p'));
                            if (descParagraphs.length > 0) {
                                // Usually the manufacturer and address is the very last paragraph
                                const lastP = descParagraphs[descParagraphs.length - 1].innerText;
                                if (lastP && lastP.length < 300) {
                                    addressText += ' ' + lastP;
                                }
                            }
                        }

                        results.manufacturer_address = addressText.trim().replace(/\\n/g, ' ');

                        // Final logic checks
                        const ownBrandKeywords = [
                            'Asda', 'Extra Special', 'Sainsburys', 'Sainsbury\\'s', 'Taste the Difference', 'By Sainsbury\\'s',
                            'Waitrose', 'Essential Waitrose', 'Waitrose No.1', 'Tesco', 'Tesco Finest', 'Morrisons', 'The Best',
                            'Ocado', 'Boots', 'Superdrug', 'H&B', 'Holland & Barrett', 'Sephora'
                        ];
                        
                        results.isOwnBrand = ownBrandKeywords.some(kw => results.name.toLowerCase().includes(kw.toLowerCase()));
                        
                        // Exclusion for Habitat at Sainsbury's
                        if (retailer === 'Sainsburys' && (results.name.toLowerCase().includes('habitat') || window.location.href.toLowerCase().includes('habitat'))) {
                            results.isHabitat = true;
                        }

                        // Exclusion for Tesco Marketplace
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
            }`,
          timeoutSecs: 1800,
          pageFunctionTimeoutSecs: 180,
          requestHandlerTimeoutSecs: 180,
          navigationTimeoutSecs: 60
        }, {
          webhooks: [{ eventTypes: ['ACTOR.RUN.SUCCEEDED'], requestUrl: webhookUrl + '&source=puppeteer' }]
        });
        runs.push({ id: run.id, actor: 'puppeteer-scraper', retailers: puppeteerRetailersToScrape });
      }
    }

    if (runs.length === 0) {
      return response.status(400).json({ error: 'No scrapers triggered.', debug: { retailers } });
    }

    return response.status(200).json({
      message: `Triggered ${runs.length} runs`,
      runId: runs[0].id,
      runs,
      debug: { ecommerceRetailersToScrape, puppeteerRetailersToScrape }
    });
  } catch (error) {
    console.error('Fatal Error:', error);
    return response.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
