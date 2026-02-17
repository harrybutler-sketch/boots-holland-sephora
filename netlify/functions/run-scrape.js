import { ApifyClient } from 'apify-client';

export const handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    const { retailers, workspace } = body || {};
    console.log('--- Scrape Trigger Received (Netlify) ---');
    console.log('Workspace:', workspace);
    console.log('Retailers:', retailers);

    if (!retailers || !Array.isArray(retailers) || retailers.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Retailers list is required', debug: { body } }) };
    }

    if (!process.env.APIFY_TOKEN) {
      return { statusCode: 500, body: JSON.stringify({ error: 'APIFY_TOKEN is missing' }) };
    }

    const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

    // 1. Defined eCommerce Scraper Retailers ("The Big 4")
    const ecommerceMap = {
      'tesco': 'Tesco'
    };

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

    const host = event.headers.host || 'boots-holland-sephora.vercel.app';
    const webhookUrl = `https://${host}/.netlify/functions/run-status?workspace=${workspace || 'beauty'}`;
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
        startUrls.push({ url: 'https://www.waitrose.com/ecom/shop/browse/groceries/new', userData: { retailer: 'Waitrose', label: 'LISTING' } });
      }
      if (pRetailers.some(r => r.includes('morrisons'))) {
        startUrls.push({ url: 'https://groceries.morrisons.com/categories/new/192077', userData: { retailer: 'Morrisons', label: 'LISTING' } });
      }
      if (pRetailers.some(r => r.includes('ocado'))) {
        startUrls.push({ url: 'https://www.ocado.com/categories/new-trending/new/9c727c0b-e6d8-4e07-b6d9-5126e8c9ef9d?boolean=new&sortBy=favorite', userData: { retailer: 'Ocado', label: 'LISTING' } });
      }
      if (pRetailers.some(r => r.includes('asda'))) {
        startUrls.push({ url: 'https://groceries.asda.com/search/new%20in', userData: { retailer: 'Asda', label: 'LISTING' } });
        startUrls.push({ url: 'https://groceries.asda.com/shelf/new-in/1215685911554', userData: { retailer: 'Asda', label: 'LISTING' } });
      }
      if (pRetailers.some(r => r.includes('superdrug'))) {
        startUrls.push({ url: 'https://www.superdrug.com/new-in/c/new', userData: { retailer: 'Superdrug', label: 'LISTING' } });
      }

      if (startUrls.length > 0) {
        console.log('Starting Puppeteer Scraper...');
        const run = await client.actor('apify/puppeteer-scraper').start({
          startUrls,
          useChrome: true,
          stealth: true,
          maxPagesPerCrawl: pRetailers.some(r => r.includes('tesco')) ? 80 : 400, // ~50 items per category (4 categories = 200 items total)
          proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'] },
          pageFunction: `async function pageFunction(context) {
                const { page, request, log, enqueueLinks } = context;
                const { label, retailer } = request.userData;
                
                if (label === 'LISTING') {
                    log.info('Listing page (' + retailer + '): ' + request.url);
                    
                    const selectors = {
                        'Holland & Barrett': 'a[href*="/shop/product/"]',
                        'Sephora': 'a.Product-link',
                        'Boots': 'a.oct-teaser-wrapper-link, a.oct-teaser__title-link',
                        'Waitrose': 'a[href*="/ecom/products/"]',
                        'Ocado': 'a[href*="/products/"]',
                        'Morrisons': 'a[href*="/products/"]',
                        'Sainsburys': '.pt__swiper a.pt__link, a[href*="/gol-ui/product/"]',
                        'Tesco': 'a[href*="/products/"], a[class*="titleLink"]',
                        'Asda': 'a[href*="/product/"], a.chakra-link',
                        'Superdrug': 'a.cx-product-name, a.product-image-container'
                    };
                    
                    const selector = selectors[retailer] || 'a[href*="/product/"], a[href*="/p/"]';
                    
                    // 1. Handle Overlays (Cookie Banners) FIRST
                    try {
                        const cookieSelector = '#onetrust-accept-btn-handler, #onetrust-banner-sdk button';
                        const cookieBtn = await page.$(cookieSelector);
                        if (cookieBtn) {
                            log.info('Accepting cookie banner...');
                            await cookieBtn.click();
                            await new Promise(r => setTimeout(r, 3000));
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

                    // 3. Humanized Scrolling to trigger JS hydration
                    log.info('Scrolling to trigger lazy-loading...');
                    await page.evaluate(async (retailer) => {
                        const scrolls = retailer === 'Sainsburys' ? 3 : 5;
                        const distance = retailer === 'Sainsburys' ? 600 : 800;
                        for (let i = 0; i < scrolls; i++) {
                            window.scrollBy(0, distance);
                            // Randomized wait for Sainsbury's
                            const waitTime = retailer === 'Sainsburys' ? (800 + Math.random() * 1000) : 500;
                            await new Promise(r => setTimeout(r, waitTime));
                        }
                    }, retailer);

                    // 4. Robust Wait for links to appear
                    try {
                        const waitTimeout = retailer === 'Sainsburys' ? 45000 : 20000;
                        await page.waitForSelector(selector, { timeout: waitTimeout });
                        if (retailer === 'Sainsburys') {
                            log.info('Sainsburys links found, waiting for final hydration...');
                            await new Promise(r => setTimeout(r, 6000)); // Extra wait for Sainsbury's JS
                        }
                    } catch (e) {
                        log.warning('Timeout waiting for selector: ' + selector + ' on ' + request.url);
                        
                        // Fallback check if links exist but selector wait failed
                        const linksExist = await page.evaluate((sel) => !!document.querySelector(sel), selector);
                        if (!linksExist) {
                             log.error('Links NOT found after waiting. Content may be blocked or not loading. URL: ' + request.url);
                             return;
                        }
                    }

                    // 5. Enqueue product links
                    const links = await page.$$(selector);
                    log.info('Found ' + (links ? links.length : 0) + ' potential links for ' + retailer);
                    
                    await enqueueLinks({
                        selector: selector,
                        userData: { 
                            retailer: retailer,
                            label: 'DETAIL'
                        }
                    });
                } else {
                    log.info('Product page (' + retailer + '): ' + request.url);
                    await new Promise(r => setTimeout(r, 6000));
                    
                    return await page.evaluate((retailer) => {
                        let name = document.title;
                        const h1 = document.querySelector('h1');
                        if (h1 && h1.innerText && h1.innerText.length > 5 && h1.innerText.toLowerCase() !== 'error') {
                            // IMPROVED: Join child nodes with spaces to avoid "WaitroseTripleSandwich"
                            name = Array.from(h1.childNodes)
                                .map(node => node.textContent.trim())
                                .filter(t => t.length > 0)
                                .join(' ');
                        } else {
                            const ogTitle = document.querySelector('meta[property="og:title"]');
                            if (ogTitle && ogTitle.content) name = ogTitle.content;
                        }

                        // Clean up name (remove retailer suffixes)
                        name = name.replace(/ - Tesco Groceries$/i, '')
                                   .replace(/ | Boots$/i, '')
                                   .replace(/ | Sephora/i, '')
                                   .trim();

                        const results = { url: window.location.href, retailer: retailer, name: name, reviews: 0, image: '' };

                        // Detect Error Pages
                        if (name.toLowerCase() === 'error' || name.toLowerCase().includes('access denied') || name.toLowerCase().includes('page not found')) {
                            results.status = 'Blocked/Error';
                        }

                        // Waitrose Specific: Detect own brands from page content
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

                        // Fallback Image Extraction
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
                                '#main-product-image'
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
                        return results;
                    }, retailer);
                }
            }`,
          timeoutSecs: 1200,
          requestHandlerTimeoutSecs: 180,
          navigationTimeoutSecs: 60
        }, {
          webhooks: [{ eventTypes: ['ACTOR.RUN.SUCCEEDED'], requestUrl: webhookUrl + '&source=puppeteer' }]
        });
        runs.push({ id: run.id, actor: 'puppeteer-scraper', retailers: puppeteerRetailersToScrape });
      }
    }

    if (runs.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No scrapers triggered.', debug: { retailers } }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Triggered ${runs.length} runs`,
        runId: runs[0].id,
        runs,
        debug: { ecommerceRetailersToScrape, puppeteerRetailersToScrape }
      }),
    };
  } catch (error) {
    console.error('Fatal Error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Internal Server Error' }) };
  }
};
