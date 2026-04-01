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
        // Limit Tesco to 300 products, others to 500 to save cost
        const maxItems = ecommerceRetailersToScrape.some(r => r.toLowerCase().includes('tesco')) ? 300 : 500;

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
          'https://www.tesco.com/shop/en-GB/buylists/new-ranges/new-frozen-and-fresh-food?count=24&page=2#top',
          'https://www.tesco.com/shop/en-GB/buylists/new-ranges/new-frozen-and-fresh-food?count=24&page=3#top',
          'https://www.tesco.com/shop/en-GB/buylists/new-ranges/new-frozen-and-fresh-food?count=24&page=4#top'
        ];
        tescoUrls.forEach(url => startUrls.push({ url, userData: { retailer: 'Tesco', label: 'LISTING' } }));
      }
      if (pRetailers.some(r => r.includes('sainsbury'))) {
        const sainsburyUrls = [
          'https://www.sainsburys.co.uk/gol-ui/features/new-in-frozen'
        ];
        sainsburyUrls.forEach(url => startUrls.push({ url, userData: { retailer: 'Sainsburys', label: 'LISTING' } }));
      }
      if (pRetailers.some(r => r.includes('waitrose'))) {
        startUrls.push({ url: 'https://www.waitrose.com/ecom/shop/browse/groceries/new/drinks?srsltid=AfmBOooKM98Ui8176ymqqxOJPFOQXSyUlzCwkxv5jd3yb4VseBO_bBKu', userData: { retailer: 'Waitrose', label: 'LISTING' } });
      }
      if (pRetailers.some(r => r.includes('morrisons'))) {
        const morrisonsUrls = [
          'https://groceries.morrisons.com/categories/fresh-chilled-foods/176739?boolean=new&sortBy=favorite',
          'https://groceries.morrisons.com/categories/food-cupboard/102705?boolean=new&sortBy=favorite'
        ];
        morrisonsUrls.forEach(url => startUrls.push({ url, userData: { retailer: 'Morrisons', label: 'LISTING' } }));
      }
      if (pRetailers.some(r => r.includes('ocado'))) {
        const ocadoUrls = [
          'https://www.ocado.com/categories/food-cupboard/e67ba77e-b886-4d6d-a42e-7aa75cc0d52d?boolean=new',
          'https://www.ocado.com/search?q=goodies&boolean=new',
          'https://www.ocado.com/categories/food-cupboard/biscuits/8b50328c-ddf3-487a-9aef-957c07d2d0cc?boolean=new&sortBy=favorite',
          'https://www.ocado.com/categories/soft-drinks-tea-coffee/513db630-94bc-4ed0-9b62-fe038f108bb7?boolean=new&sortBy=favorite'
        ];
        ocadoUrls.forEach(url => startUrls.push({ url, userData: { retailer: 'Ocado', label: 'LISTING' } }));
      }
      if (pRetailers.some(r => r.includes('asda'))) {
        startUrls.push({ url: 'https://groceries.asda.com/search/New%20in', userData: { retailer: 'Asda', label: 'LISTING' } });
      }
      if (pRetailers.some(r => r.includes('superdrug'))) {
        startUrls.push({ url: 'https://www.superdrug.com/new-in/c/new', userData: { retailer: 'Superdrug', label: 'LISTING' } });
      }

      if (startUrls.length > 0) {
        console.log('Starting Puppeteer Scraper...');
        const maxPages = 100; // Reduced from 300 to balance cost and yield

        const run = await client.actor('apify/puppeteer-scraper').start({
          startUrls,
          useChrome: true,
          useStealth: true,
          stealth: true,
          launchContext: {
            stealth: true,
            useChrome: true
          },
          maxPagesPerCrawl: maxPages,
          proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'], countryCode: 'GB' },
          // CUSTOM USER AGENT to appear more like a real user
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
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
                            // EXTRA SAFETY: Don't click if products are already visible (might trigger a reload/blank)
                            const productsVisible = await page.evaluate((sel) => document.querySelectorAll(sel).length > 0, selector);
                            if (!productsVisible) {
                                log.info('Accepting cookie banner to reveal content...');
                                await cookieBtn.click();
                                await new Promise(r => setTimeout(r, 4000));
                            } else {
                                log.info('Cookie banner present but products visible. Skipping click to avoid disruption.');
                            }
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
                        'Tesco': 'a[href*="/products/"]:not([href*="onetrust"]), a[class*="titleLink"]',
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
                            // Defensive styling for desktop layout
                            if (document.body) {
                                document.body.style.minWidth = '1920px';
                                document.body.style.width = '1920px';
                            }
                        }
                        
                        // Wait for products to appear before starting the scroll loop
                        const waitForProducts = () => {
                            return new Promise((resolve) => {
                                const check = () => {
                                    const products = document.querySelectorAll('a[href*="/products/"]:not([href*="onetrust"])');
                                    if (products.length > 0) resolve();
                                    else setTimeout(check, 500);
                                };
                                check();
                                // Timeout after 10s if no products appear
                                setTimeout(resolve, 10000);
                            });
                        };
                        
                        if (isMorrisons || isAsda) {
                            await waitForProducts();
                            // Robust Dynamic Scroll for React Infinite Grids
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
                                        // We hit bottom, wait and see if it expands
                                        if (currentHeight === lastHeight) {
                                            noChangeCount++;
                                        } else {
                                            noChangeCount = 0;
                                            lastHeight = currentHeight;
                                        }
                                    }
                                    
                                    // Stop if no height change for 80 ticks (20 seconds) 
                                    // Morrisons can be very slow to re-hydrate, so we must be patient.
                                    if (noChangeCount > 80 || totalScrolls > 600) {
                                        clearInterval(scrollInterval);
                                        resolve();
                                    }
                                }, 250);
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
                        const waitTimeout = retailer === 'Sainsburys' ? 75000 : (retailer === 'Asda' ? 60000 : 30000);
                        await page.waitForSelector(selector, { timeout: waitTimeout });
                        
                        // Extra Waiter for stability (prevent React re-renders from hiding new elements)
                        if (retailer === 'Asda' || retailer === 'Sainsburys' || retailer === 'Morrisons') {
                            log.info('Waiting for product count to stabilize...');
                            await new Promise(r => setTimeout(r, 15000));
                        }
                    } catch (e) {
                        log.warning('Timeout or limited results during wait for ' + selector + ' on ' + request.url);
                        // Take a screenshot on failure to diagnose "blank page" issues
                        const title = await page.title();
                        log.info('Page title during timeout: ' + title);
                    }

                    // 5. Enqueue product links manually for better reliability
                    const productLinks = await page.evaluate((sel, ret) => {
                        const hostname = window.location.hostname;
                        return Array.from(document.querySelectorAll(sel))
                            .map(a => a.href)
                            .filter(href => {
                                if (!href) return false;
                                if (href.includes('onetrust')) return false;
                                try {
                                    const urlObj = new URL(href);
                                    // Ensure the link is on the same domain or at least contains the retailer name for safety
                                    return urlObj.hostname.includes(ret.toLowerCase().replace('sainsburys', 'sainsbury').replace(' ', '')) || urlObj.hostname.includes('tesco.com') || urlObj.hostname.includes('asda.com');
                                } catch (e) { return false; }
                            });
                    }, selector, retailer);

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
                    
                    if (retailer === 'Tesco') {
                        // 1. Immediate Block/Oops check
                        const isBlocked = await page.evaluate(() => {
                            const bodyText = document.body.innerText.toLowerCase();
                            const h1Text = document.querySelector('h1')?.innerText?.toLowerCase() || '';
                            return h1Text.includes('oops') || h1Text.includes('something went wrong') || bodyText.includes('access denied') || h1Text.includes('back');
                        });
                        
                        if (isBlocked) {
                            throw new Error('Tesco Blocked ("Oops" page detected). Retrying with fresh proxy...');
                        }

                        // 2. Humanized delay AFTER confirming we aren't immediately blocked
                        const randomWait = 3000 + (Math.random() * 5000);
                        log.info('Humanized detail-page delay: ' + Math.round(randomWait) + 'ms');
                        await new Promise(r => setTimeout(r, randomWait));

                        // 3. Hydration check with broad selectors
                        try {
                            await page.waitForFunction(() => {
                                const title = document.querySelector('h1.product-details-tile__title, h1.product-details-page__title, h1, [data-testid="product-title"]');
                                const price = document.querySelector('.price-per-basket-unit, .price-details--unit-price, .value, [data-testid="product-price"], .price-per-quantity-weight');
                                return title && title.innerText.trim().length > 3 && price && price.innerText.trim().length > 0;
                            }, { timeout: 40000 });
                        } catch (e) {
                            throw new Error('Hydration Timeout on ' + request.url + ' - Price or Title not found. Retrying...');
                        }
                    } else {
                        // Standard delay for other retailers
                        const randomWait = 4000 + (Math.random() * 6000);
                        await new Promise(r => setTimeout(r, randomWait));
                    }
                    
                    const extractionData = await page.evaluate((retailer) => {
                         const mainContent = document.querySelector('main, #main, .product-details-page, [role="main"]');
                          const tescoTitle = document.querySelector('h1.product-details-tile__title, h1.product-details-page__title'); // Specific PDP H1
                          const h1 = tescoTitle || (mainContent ? mainContent.querySelector('h1') : document.querySelector('h1'));
                          let name = h1 ? h1.innerText.trim() : document.title;
                         
                         // Priority 1: H1 from main content area
                         if (h1 && h1.innerText && h1.innerText.length > 3 && !h1.innerText.toLowerCase().includes('oops')) {
                             name = h1.innerText.trim();
                         } 
                         // Priority 2: Meta Tags
                         else {
                             const ogTitle = document.querySelector('meta[property="og:title"]');
                             if (ogTitle && ogTitle.content) name = ogTitle.content;
                         }
                        
                         name = name.replace(/ - Tesco Groceries$/i, '')
                                    .replace(/ \| Boots$/i, '')
                                    .replace(/ \| Sephora/i, '')
                                    .replace(/ - Asda Groceries$/i, '')
                                    .replace(/^Back$/i, '') // Safety: ignore rogue "Back" buttons
                                    .replace(/^New products at Tesco$/i, '') // Safety: ignore category headers
                                    .trim();

                         const results = { url: window.location.href, retailer: retailer, name: name, reviews: 0, image: '' };
                         
                         // MARKETPLACE DETECTION: Search for specific partner seller links
                         if (retailer === 'Tesco') {
                             const marketplaceLink = document.querySelector('a.marketplace-seller-link');
                             if (marketplaceLink) {
                                 results.status = 'Marketplace';
                             }
                         }

                          // BLANK PAGE OR BLOCK DETECTION: If price is missing after timeout, treat as block
                          const hasPrice = !!document.querySelector('.price-per-quantity-weight, .price-details--unit-price, .value');
                          if (!name || name.length < 2 || !hasPrice) {
                             results.status = 'Blocked/Error';
                         }
                        
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
                         
                         // Specific image selector to catch product-details-tile images
                         if (!results.image) {
                             const tescoImg = document.querySelector('.product-details-tile__image-container img');
                             if (tescoImg) results.image = tescoImg.src || tescoImg.alt;
                             
                             const ogImage = document.querySelector('meta[property="og:image"]');
                             if (!results.image && ogImage) results.image = ogImage.getAttribute('content');
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


                        return results;
                    }, retailer);

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
                        throw new Error('Tesco Blocked or Error Page detected: ' + extractionData.name + '. Retrying...');
                    }
                    
                    return extractionData;
                }
            }`,
          timeoutSecs: 1800,
          pageFunctionTimeoutSecs: 180,
          requestHandlerTimeoutSecs: 180,
          maxConcurrency: 1,
          navigationTimeoutSecs: 60,
          useStealth: true,
          fingerprinting: true,
          proxyConfiguration: { useApifyProxy: true, groups: ['RESIDENTIAL'], countryCode: 'GB' }
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
