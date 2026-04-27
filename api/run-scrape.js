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
      'Tesco': 'https://www.tesco.com/groceries/en-GB/shop/drinks/all?sortBy=relevance&facetsArgs=new%3Atrue&count=24',
      'Asda': 'https://www.asda.com/groceries/event/new-beer-wine-spirits'
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
          proxyConfiguration: { 
            useApifyProxy: true
          },
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
        startUrls.push({ url: 'https://www.sephora.co.uk/new-at-sephora?filter=fh_location=//c1/en_GB/in_stock%3E{in}/new_in=1/!exclude_countries%3E{gb}/!site_exclude%3E{79}/!brand=a70/%26fh_view_size=40%26date_time=20260413T104639%26site_area=cms%26device=desktop%26fh_sort_by=-%24rc_new_in#inline-facets', userData: { retailer: 'Sephora', label: 'LISTING' } });
      }
      if (pRetailers.some(r => r.includes('boots'))) {
        startUrls.push({ url: 'https://www.boots.com/new-to-boots', userData: { retailer: 'Boots', label: 'LISTING' } });
      }
      if (pRetailers.some(r => r.includes('holland'))) {
        startUrls.push({ url: 'https://www.hollandandbarrett.com/shop/highlights/new-in/?category=8939&page=2#products-list', userData: { retailer: 'Holland & Barrett', label: 'LISTING' } });
      }
      if (pRetailers.some(r => r.includes('tesco'))) {
        const tescoUrls = [
          'https://www.tesco.com/groceries/en-GB/shop/drinks/all?sortBy=relevance&facetsArgs=new%3Atrue&count=24'
        ];
        tescoUrls.forEach(url => startUrls.push({ url, userData: { retailer: 'Tesco', label: 'LISTING' } }));
      }
      if (pRetailers.some(r => r.includes('sainsbury'))) {
        const sainsburyUrls = [
          'https://www.sainsburys.co.uk/gol-ui/features/newdrinks',
          'https://www.sainsburys.co.uk/gol-ui/features/newdrinks/opt/page:2',
          'https://www.sainsburys.co.uk/gol-ui/features/newdrinks/opt/page:3',
          'https://www.sainsburys.co.uk/gol-ui/features/newdrinks/opt/page:4'
        ];
        sainsburyUrls.forEach(url => startUrls.push({ url, userData: { retailer: 'Sainsburys', label: 'LISTING' } }));
      }
      if (pRetailers.some(r => r.includes('waitrose'))) {
        const waitroseUrls = [
          'https://www.waitrose.com/ecom/shop/browse/groceries/new/toiletries_health_and_beauty?srsltid=AfmBOoo4qUQyJ3BJhzKG2Uo3hgUJVh76roqA5LLJBuTTcQVEJuFPN67c',
          'https://www.waitrose.com/ecom/shop/browse/groceries/new/drinks?srsltid=AfmBOoo4qUQyJ3BJhzKG2Uo3hgUJVh76roqA5LLJBuTTcQVEJuFPN67c'
        ];
        waitroseUrls.forEach(url => startUrls.push({ url, userData: { retailer: 'Waitrose', label: 'LISTING' } }));
      }
      if (pRetailers.some(r => r.includes('morrisons'))) {
        const morrisonsUrls = [
          'https://groceries.morrisons.com/categories/food-cupboard/102705?boolean=new&sortBy=favorite'
        ];
        morrisonsUrls.forEach(url => startUrls.push({ url, userData: { retailer: 'Morrisons', label: 'LISTING' } }));
      }
      if (pRetailers.some(r => r.includes('ocado'))) {
        const ocadoUrls = [
          'https://www.ocado.com/categories/food-cupboard/e67ba77e-b886-4d6d-a42e-7aa75cc0d52d?boolean=new&sortBy=favorite'
        ];
        ocadoUrls.forEach(url => startUrls.push({ url, userData: { retailer: 'Ocado', label: 'LISTING' } }));
      }
      if (pRetailers.some(r => r.includes('asda'))) {
        startUrls.push({ url: 'https://www.asda.com/groceries/event/new-beer-wine-spirits', userData: { retailer: 'Asda', label: 'LISTING' } });
      }
      if (pRetailers.some(r => r.includes('superdrug'))) {
        startUrls.push({ url: 'https://www.superdrug.com/new-in/c/new', userData: { retailer: 'Superdrug', label: 'LISTING' } });
      }

      if (startUrls.length > 0) {
        const TESCO_RESILIENT_FUNCTION = `async ({ page, request, log, enqueueLinks, response }) => {
            const { url, userData: { retailer, label } } = request;
            
            await page.setViewport({ width: 1920, height: 1080 });
            await page.setExtraHTTPHeaders({
                'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
                'referer': 'https://www.google.com/'
            });

            // Warming/Bypass
            log.info('Warming Tesco session...');
            await page.goto('https://www.tesco.com/groceries/en-GB/', { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => log.warning('Warming navigation timed out, continuing...'));
            await new Promise(r => setTimeout(r, 3000));
            
            log.info('Navigating to target: ' + url);
            const navResponse = await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 }).catch(e => {
                log.error('Primary navigation failed: ' + e.message);
                return null;
            });

            if (!navResponse) {
                log.warning('Attempting to proceed despite navigation error...');
            }

            // Cookie Acceptance
            try {
                const cookieId = 'button.ddsweb-consent-banner__button';
                await page.waitForSelector(cookieId, { timeout: 8000 });
                await page.click(cookieId);
                await new Promise(r => setTimeout(r, 1500));
            } catch (e) {
                log.info('Cookie banner not found or already accepted.');
            }

            // Wait for products - more robust selectors
            log.info('Waiting for product items...');
            const productSelector = 'li[class*="Tile"], [data-testid="product-tile"], .product-list--item, .styles__StyledTiledQueryResult-sc';
            await page.waitForSelector(productSelector, { timeout: 45000 }).catch(() => log.warning('Timeout waiting for products. Still attempting extraction.'));

            // Scroll for hydration
            log.info('Scrolling for hydration...');
            for (let i = 0; i < 12; i++) {
                await page.evaluate(() => window.scrollBy(0, 800));
                await new Promise(r => setTimeout(r, 800));
            }

            // Extraction
            const products = await page.evaluate(() => {
                const tiles = Array.from(document.querySelectorAll('li[class*="Tile"], [data-testid="product-tile"], .product-list--item, article, [class*="StyledTiledQueryResult"] li'));
                return tiles.map(tile => {
                    const nameEl = tile.querySelector('h2 a, a[class*="titleLink"], a[href*="/products/"], [data-testid="product-title"]');
                    if (!nameEl) return null;
                    const name = nameEl.innerText.trim();
                    if (!name || name.length < 3) return null;

                    const priceEl = tile.querySelector('p[class*="priceText"], .ddsweb-price--primary, [data-testid="unit-price"], .price, .styles__StyledPrice-sc');
                    const imgEl = tile.querySelector('img');

                    return {
                        product_name: name,
                        retailer: 'Tesco',
                        price_display: priceEl?.innerText?.trim() || 'N/A',
                        product_url: nameEl.href || window.location.href,
                        image_url: imgEl?.src || '',
                        date_found: new Date().toISOString()
                    };
                }).filter(Boolean);
            });

            log.info(\`Found \${products.length} products total.\`);

            const filtered = products.filter(p => {
                const ln = p.product_name.toLowerCase();
                const isOwnBrand = ln.includes('tesco') || ln.includes('finest') || ln.includes('stockwell') || ln.includes('ms price');
                return !isOwnBrand;
            });

            log.info(\`Filtered to \${filtered.length} non-own-brand products.\`);

            await enqueueLinks({ 
                selector: 'a[aria-label*="next page"], [data-testid="pagination-next"], a.pagination--button--next', 
                label: 'LISTING', 
                userData: { retailer: 'Tesco' } 
            }).catch(() => {});

            return filtered;
        }`;

        const ASDA_STABLE_PAGE_FUNCTION = `async ({ page, request, log, enqueueLinks, response }) => {
            const { url, userData: { retailer, label } } = request;
            
            await page.setViewport({ width: 1920, height: 1080 });
            await page.setExtraHTTPHeaders({
                'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
                'referer': 'https://www.google.com/'
            });

            log.info('Warming Asda session...');
            await page.goto('https://www.asda.com/', { waitUntil: 'networkidle2', timeout: 45000 }).catch(() => log.warning('Asda warm-up timed out.'));
            await new Promise(r => setTimeout(r, 3000));
            
            log.info('Navigating to target: ' + url);
            const navResponse = await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 }).catch(e => {
                log.error('Asda navigation failed: ' + e.message);
                return null;
            });
            
            // Cookie Acceptance
            try {
                const cookieId = '#onetrust-accept-btn-handler';
                await page.waitForSelector(cookieId, { timeout: 10000 });
                await page.click(cookieId);
                await new Promise(r => setTimeout(r, 2000));
            } catch (e) {
                log.info('Asda cookie banner not found or handled.');
            }

            // Wait for products - refined selector
            log.info('Waiting for Asda products...');
            const asdaSelector = '[data-testid="product-tile"], .co-item, .asda-product-tile';
            await page.waitForSelector(asdaSelector, { timeout: 45000 }).catch(() => log.warning('No Asda products rendered after 45s. Attempting extraction anyway.'));

            // Scroll for hydration
            log.info('Scrolling for hydration...');
            for (let i = 0; i < 15; i++) {
                await page.evaluate(() => window.scrollBy(0, 1000));
                await new Promise(r => setTimeout(r, 800));
            }

            // Extraction
            const products = await page.evaluate(() => {
                const tiles = Array.from(document.querySelectorAll('[data-testid="product-tile"], .co-item, .asda-product-tile, article[class*="product"]'));
                return tiles.map(tile => {
                    const nameEl = tile.querySelector('h3 a, .co-product__title a, a[href*="/product/"], [class*="title"] a');
                    if (!nameEl) return null;
                    const name = nameEl.innerText.trim();
                    if (!name || name.length < 3) return null;

                    const priceEl = tile.querySelector('.co-product__price, [data-testid="price"], .product-price, .co-item__price');
                    const imgEl = tile.querySelector('img');

                    return {
                        product_name: name,
                        retailer: 'Asda',
                        price_display: priceEl?.innerText?.trim() || 'N/A',
                        product_url: nameEl.href || window.location.href,
                        image_url: imgEl?.src || '',
                        date_found: new Date().toISOString()
                    };
                }).filter(Boolean);
            });

            log.info(\`Extracted \${products.length} Asda products.\`);

            const filtered = products.filter(p => {
                const ln = p.product_name.toLowerCase();
                const isOwnBrand = ln.includes('asda') || ln.includes('extra special') || ln.includes('just essentials') || ln.includes('smart price');
                return !isOwnBrand;
            });

            log.info(\`Filtered to \${filtered.length} non-own-brand Asda products.\`);

            await enqueueLinks({ 
                selector: 'a[aria-label="Next page"], button[aria-label="Next page"], .co-pagination__next', 
                label: 'LISTING', 
                userData: { retailer: 'Asda' } 
            }).catch(() => {});

            return filtered;
        }`;

        const STABLE_PAGE_FUNCTION = `async (context) => {
            const { page, request, enqueueLinks, response } = context;
            const { url, userData: { retailer, label } } = request;
            
            if (label === 'LISTING') {
                console.log('Scraping listing: ' + url + ' (' + retailer + ')');
                const selectors = {
                    'Sainsburys': '.pt__link, a[href*="/gol-ui/product/"], a[href*="/product/"]',
                    'Waitrose': 'a[href*="/ecom/products/"]',
                    'Morrisons': 'a[href*="/products/"]',
                    'Ocado': 'a[href*="/products/"]',
                    'Tesco': 'a[href*="/products/"]:not([href*="onetrust"])',
                    'Asda': 'a[href*="/product/"]',
                    'Boots': 'a[href*="/product/"], a[href*="/p/"]',
                    'Superdrug': 'a[href*="/p/"]',
                    'Sephora': 'a[href*="/p/"]',
                    'Holland & Barrett': 'a[href*="/shop/product/"]'
                };
                const selector = selectors[retailer] || 'a[href*="/product/"], a[href*="/p/"]';
                
                if (retailer === 'Tesco') {
                    await page.setViewport({ width: 1920, height: 1080 });
                    await page.setExtraHTTPHeaders({
                        'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
                        'sec-ch-ua-mobile': '?0',
                        'sec-ch-ua-platform': '"Windows"',
                        'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
                        'referer': 'https://www.google.com/'
                    });
                }

                // Scrolling for hydration (Robust logic for infinite grids)
                await page.evaluate(async (ret) => {
                    const isMorrisons = ret === 'Morrisons';
                    const isAsda = ret === 'Asda';
                    const isSainsburys = ret === 'Sainsburys';
                    
                    if (isMorrisons) {
                        if (document.body) {
                            document.body.style.minWidth = '1920px';
                            document.body.style.width = '1920px';
                        }
                    }

                    const waitForProducts = async () => {
                        const sel = isMorrisons ? 'a[href*="/products/"]' : (isSainsburys ? '.pt__link' : 'a[href*="/product/"]');
                        for (let i = 0; i < 20; i++) {
                            if (document.querySelectorAll(sel).length > 2) return true;
                            await new Promise(r => setTimeout(r, 500));
                        }
                        return false;
                    };

                    if (isSainsburys) {
                        const scrolls = 15;
                        for (let i = 0; i < scrolls; i++) {
                            window.scrollBy(0, 800);
                            const waitTime = (1000 + Math.random() * 1000);
                            await new Promise(r => setTimeout(r, waitTime));
                        }
                        return;
                    }

                    await waitForProducts();

                    await new Promise((resolve) => {
                        let totalHeight = 0;
                        let distance = 400;
                        let totalScrolls = 0;
                        let lastHeight = document.body.scrollHeight;
                        let noChangeCount = 0;

                        const timer = setInterval(async () => {
                            const scrollHeight = document.body.scrollHeight;
                            window.scrollBy(0, distance);
                            totalHeight += distance;
                            totalScrolls++;

                            if (scrollHeight === lastHeight) {
                                noChangeCount++;
                            } else {
                                noChangeCount = 0;
                                lastHeight = scrollHeight;
                            }

                            if (noChangeCount > 60 || totalScrolls > 500) {
                                clearInterval(timer);
                                resolve();
                            }
                        }, 250);
                    });
                }, retailer);

                // SAINSBURYS OPTIMIZATION: Quick check if page is empty before the long wait
                const hasProducts = await page.evaluate((sel) => document.querySelectorAll(sel).length > 0, selector);
                
                if (hasProducts || retailer !== 'Sainsburys') {
                    const waitTimeout = retailer === 'Sainsburys' ? 60000 : 30000;
                    await page.waitForSelector(selector, { timeout: waitTimeout }).catch(e => console.log('Timeout of selector: ' + selector));
                } else {
                    console.log('No products found initially on ' + retailer + '. Likely empty category.');
                }
                
                const nextSelectors = {
                    'Sainsburys': 'a[aria-label="Next page"]',
                    'Waitrose': 'a[aria-label="Next page"]',
                    'Morrisons': 'a.next-page, a[aria-label*="Next"]',
                    'Ocado': 'a.next-page',
                    'Tesco': 'a.pagination--button--next, [data-testid="pagination-next"]',
                    'Asda': 'a[aria-label="Next page"], button[aria-label="Next page"]',
                    'Holland & Barrett': 'a.PagingButtons-module_pagingLinkWrapper__kjUec'
                };
                
                await enqueueLinks({
                    selector,
                    label: 'DETAIL',
                    userData: { retailer }
                });

                const nextSelector = nextSelectors[retailer];
                if (nextSelector) {
                    const nextButton = await page.$(nextSelector);
                    if (nextButton) {
                        await enqueueLinks({ selector: nextSelector, label: 'LISTING', userData: { retailer } });
                    }
                }
            } else if (label === 'DETAIL') {
                await page.waitForSelector('h1', { timeout: 15000 }).catch(() => {});
                const results = await page.evaluate((retailer) => {
                    const res = {
                        product_name: document.querySelector('h1')?.innerText?.trim() || 'N/A',
                        retailer: retailer,
                        price_display: 'N/A',
                        reviews: 0,
                        rating: '0.0',
                        image_url: '',
                        manufacturer: '',
                        manufacturer_address: '',
                        product_url: window.location.href,
                        date_found: new Date().toISOString()
                    };

                    const priceSelectors = ['.pd__cost', '.product-details-tile__price', '.product-price', '.price'];
                    for (const sel of priceSelectors) {
                        const el = document.querySelector(sel);
                        if (el && el.innerText) { res.price_display = el.innerText.trim(); break; }
                    }

                    const imgSelectors = [
                        'img.pd__image', '.pt-image__image', '.co-product-image img', 'figure img', 'picture img',
                        'img[itemprop="image"]', 'img.product-image', '.product-image img', '#main-product-image'
                    ];
                    for (const sel of imgSelectors) {
                        const img = document.querySelector(sel);
                        if (img && img.src) { res.image_url = img.src; break; }
                    }
                    if (!res.image_url) {
                       const ogImage = document.querySelector('meta[property="og:image"]');
                       if (ogImage) res.image_url = ogImage.getAttribute('content');
                    }

                    const reviewSelectors = ['.review-summary__count', '.star-rating-link span', 'a[href="#reviews-title"] span', '[class*="starRating"] span', '.bv_numReviews_text'];
                    for (const sel of reviewSelectors) {
                        const el = document.querySelector(sel);
                        if (el) {
                            const match = el.innerText.match(/\\d+/);
                            if (match) { res.reviews = parseInt(match[0]) || 0; break; }
                        }
                    }

                    let addressText = '';
                    const mfnSelectors = ['#brand-details-panel', '[data-testid="product-details-manufacturer"]', '#product-information', '#manufacturer-details'];
                    for (const sel of mfnSelectors) {
                        const el = document.querySelector(sel);
                        if (el) addressText += ' ' + el.innerText;
                    }
                    const mfnHeaders = Array.from(document.querySelectorAll('h3, strong, span, div, summary, h4'))
                        .filter(el => {
                            const t = el.innerText ? el.innerText.toLowerCase().trim() : '';
                            return t === 'manufacturer address' || t === 'manufacturer' || t === 'return to' || t === 'manufacturer details' || t === 'brand details';
                        });
                    for (const el of mfnHeaders) {
                        let text = el.nextElementSibling ? el.nextElementSibling.innerText : '';
                        if (!text && el.parentElement) text = el.parentElement.innerText.replace(el.innerText, '');
                        if (text && text.length > 5 && text.length < 500) addressText += ' ' + text;
                    }
                    res.manufacturer_address = addressText.trim().replace(/\\n/g, ' ');

                    if (retailer === 'Sainsburys') {
                        const breadcrumbItems = document.querySelectorAll('.ds-c-breadcrumb__item');
                        if (breadcrumbItems.length > 2) res.manufacturer = breadcrumbItems[breadcrumbItems.length - 2].innerText.trim();
                    }
                    if (!res.manufacturer) res.manufacturer = res.product_name.split(' ')[0];

                    return res;
                }, retailer);

                // Quality Filters
                const ownBrandKeywords = ["Asda", "Extra Special", "Sainsbury", "Taste the Difference", "Waitrose", "Essential Waitrose", "Tesco", "Finest", "Morrisons", "The Best", "Boots", "H&B", "Holland & Barrett", "Plant Menu", "The Grocer's Kitchen"];
                const isOwnBrand = ownBrandKeywords.some(kw => {
                    const match = results.product_name.toLowerCase().includes(kw.toLowerCase());
                    const isCurrentRetailer = retailer.toLowerCase().includes(kw.toLowerCase()) || kw.toLowerCase().includes(retailer.toLowerCase().split(' ')[0]);
                    return match && !isCurrentRetailer;
                });
                
                if (isOwnBrand) {
                    console.log('Skipping Own Brand: ' + results.product_name);
                    return null;
                }
                if (results.reviews > 5) {
                    console.log('Skipping High Reviews (' + results.reviews + '): ' + results.product_name);
                    return null;
                }

                return results;
            }
        }`;
        const BEAUTY_STABLE_PAGE_FUNCTION = `async ({ page, request, log, pushData }) => {
            const url = request.url;
            const retailer = url.includes('sephora') ? 'Sephora' : 'Holland & Barrett';
            log.info(\`Scraping \${retailer}: \${url}\`);

            // Helper for delays
            const delay = ms => new Promise(r => setTimeout(r, ms));

            // Scroll and hydrate logic (April 13th baseline)
            await page.evaluate(async () => {
                for (let i = 0; i < 5; i++) {
                    window.scrollBy(0, 1000);
                    await new Promise(r => setTimeout(r, 1000));
                }
            });

            // Interaction to trigger hydration
            await page.mouse.move(100, 100);
            await delay(2000);

            const products = await page.evaluate((retailer) => {
                // Selector from my recent live inspection of H&B and Sephora
                const cardSelector = '.product-card, [class*="productCard"], .ProductCard, [class*="ProductCard"]';
                const items = Array.from(document.querySelectorAll(cardSelector));
                
                return items.map(el => {
                    const res = {};
                    const linkEl = el.querySelector('a');
                    res.product_url = linkEl ? linkEl.href : null;
                    
                    const nameEl = el.querySelector('h3, [class*="title"], [class*="productName"]');
                    res.product_name = nameEl ? nameEl.innerText.trim() : 'Unknown Product';
                    
                    // Specific Own Brand filtering for April 13th restoration
                    if (retailer === 'Sephora') {
                        const brandText = el.innerText.toLowerCase();
                        res.isOwnBrand = brandText.includes('sephora') || brandText.includes('sephora collection');
                    } else if (retailer === 'Holland & Barrett') {
                        const brandText = el.innerText.toLowerCase();
                        res.isOwnBrand = brandText.includes('holland') || brandText.includes('h&b') || brandText.includes('holland & barrett');
                    }
                    
                    res.retailer = retailer;
                    res.scraped_at = new Date().toISOString();
                    return res;
                });
            }, retailer);

            log.info(\`Extracted \${products.length} products from \${retailer}\`);

            if (products && products.length > 0) {
                for (const p of products) {
                    // Own Brand Filter (April 13th policy: Skip own brands)
                    if (p.isOwnBrand) {
                        log.info(\`Skipping own brand: \${p.product_name}\`);
                        continue;
                    }
                    await pushData(p);
                }
            }
        }`;



        const MORRISONS_STABLE_PAGE_FUNCTION = `async ({ page, request, log, pushData, enqueueLinks }) => {
            const url = request.url;
            log.info(\`Scraping Morrisons (Listing-Only): \${url}\`);

            await page.setViewport({ width: 1920, height: 1080 });
            
            // Cookie Acceptance
            try {
                const cookieId = '#onetrust-accept-btn-handler';
                await page.waitForSelector(cookieId, { timeout: 8000 });
                await page.click(cookieId);
                await new Promise(r => setTimeout(r, 1000));
            } catch (e) {}

            // Intensive scroll for hydration
            log.info('Scrolling for hydration...');
            for (let i = 0; i < 15; i++) {
                await page.evaluate(() => window.scrollBy(0, 800));
                await new Promise(r => setTimeout(r, 800));
                await page.mouse.move(Math.random() * 800, Math.random() * 600);
            }

            const products = await page.evaluate(() => {
                const tiles = Array.from(document.querySelectorAll('.product-card-container, .fop-item, .fops-item, li[class*="Product"]'));
                return tiles.map(tile => {
                    const nameEl = tile.querySelector('.title-container a, .fop-description a, a[href*="/products/"]');
                    if (!nameEl) return null;
                    const name = nameEl.innerText.trim();
                    const link = nameEl.href;
                    
                    const priceEl = tile.querySelector('.price-container, .fop-price, .price, [class*="price"]');
                    const imgEl = tile.querySelector('.image-container img, .fop-img, img');

                    return {
                        product_name: name,
                        product_url: link,
                        price_display: priceEl?.innerText?.trim() || 'N/A',
                        image_url: imgEl?.src || '',
                        retailer: 'Morrisons',
                        date_found: new Date().toISOString()
                    };
                }).filter(Boolean);
            });

            log.info(\`Extracted \${products.length} products from Morrisons\`);

            for (const p of products) {
                const ln = p.product_name.toLowerCase();
                const isOwnBrand = ln.includes('morrisons') || ln.includes('the best') || ln.includes('savers') || ln.includes('market street');
                if (!isOwnBrand) {
                    await pushData(p);
                }
            }

            await enqueueLinks({
                selector: 'a.next-page, a[aria-label*="Next"]',
                label: 'LISTING',
                userData: { retailer: 'Morrisons' }
            }).catch(() => {});
        }`;

        const OCADO_STABLE_PAGE_FUNCTION = `async ({ page, request, log, pushData, enqueueLinks }) => {
            const url = request.url;
            log.info(\`Scraping Ocado (Listing-Only): \${url}\`);

            await page.setViewport({ width: 1920, height: 1080 });
            
            // Cookie Acceptance
            try {
                const cookieId = '#onetrust-accept-btn-handler';
                await page.waitForSelector(cookieId, { timeout: 8000 });
                await page.click(cookieId);
                await new Promise(r => setTimeout(r, 1000));
            } catch (e) {}

            // Intensive scroll for hydration
            log.info('Scrolling for hydration...');
            for (let i = 0; i < 15; i++) {
                await page.evaluate(() => window.scrollBy(0, 800));
                await new Promise(r => setTimeout(r, 800));
                await page.mouse.move(Math.random() * 800, Math.random() * 600);
            }

            const products = await page.evaluate(() => {
                const tiles = Array.from(document.querySelectorAll('.product-card-container, .fops-item, .fop-item, li[class*="Product"]'));
                return tiles.map(tile => {
                    const nameEl = tile.querySelector('.title-container a, .fop-description a, a[href*="/products/"], .fop-title');
                    if (!nameEl) return null;
                    const name = nameEl.innerText.trim();
                    const link = nameEl.href || window.location.href;
                    
                    const priceEl = tile.querySelector('.price-container, .fop-price, .price, [class*="price"]');
                    const imgEl = tile.querySelector('.image-container img, .fop-img, img');

                    return {
                        product_name: name,
                        product_url: link,
                        price_display: priceEl?.innerText?.trim() || 'N/A',
                        image_url: imgEl?.src || '',
                        retailer: 'Ocado',
                        date_found: new Date().toISOString()
                    };
                }).filter(Boolean);
            });

            log.info(\`Extracted \${products.length} products from Ocado\`);

            for (const p of products) {
                const ln = p.product_name.toLowerCase();
                const isOwnBrand = ln.includes('ocado') || ln.includes('m&s') || ln.includes('marks & spencer');
                if (!isOwnBrand) {
                    await pushData(p);
                }
            }

            await enqueueLinks({
                selector: 'a.next-page, a[aria-label*="Next"]',
                label: 'LISTING',
                userData: { retailer: 'Ocado' }
            }).catch(() => {});
        }`;

        const SAINSBURYS_STABLE_PAGE_FUNCTION = `async ({ page, request, log, pushData, enqueueLinks }) => {
            const url = request.url;
            log.info(\`Scraping Sainsbury's: \${url}\`);

            // Helper for delays
            const delay = ms => new Promise(r => setTimeout(r, ms));

            // Intensive scroll for hydration (Sainsbury's is heavy on lazy loading)
            log.info('Scrolling for hydration...');
            for (let i = 0; i < 15; i++) {
                await page.evaluate(() => window.scrollBy(0, 1000));
                await delay(1000);
                // Move mouse to trigger hover-based lazy loading
                await page.mouse.move(Math.random() * 800, Math.random() * 600);
            }

            await delay(2000);

            const products = await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('.pt__link'));
                return links.map(linkEl => {
                    const tile = linkEl.closest('article, [data-testid="product-tile"], li');
                    const name = linkEl.innerText.trim();
                    const link = linkEl.href;
                    
                    let price = 'N/A';
                    let image = null;

                    if (tile) {
                        const priceEl = tile.querySelector('[data-testid="pt-retail-price"], .pt__cost');
                        if (priceEl) price = priceEl.innerText.trim();
                        const imgEl = tile.querySelector('img');
                        if (imgEl) image = imgEl.src;
                    }
                    
                    return { 
                        product_name: name,
                        product_url: link,
                        price_display: price,
                        image_url: image,
                        retailer: "Sainsbury's",
                        manufacturer: name.split(' ')[0],
                        date_found: new Date().toISOString()
                    };
                }).filter(p => p.product_name && p.product_name.length > 5);
            });

            log.info(\`Extracted \${products.length} products from Sainsbury's\`);

            if (products && products.length > 0) {
                for (const p of products) {
                    await pushData(p);
                }
            }

            // Pagination support
            await enqueueLinks({
                selector: 'a[aria-label="Next page"]',
                label: 'LISTING',
                userData: { retailer: "Sainsbury's" }
            }).catch(() => {});
        }`;


        // Separate Start URLs: Tesco vs Beauty vs Sainsbury's vs Morrisons vs Ocado vs The Rest
        const tescoStartUrls = startUrls.filter(u => u.userData.retailer === 'Tesco');
        const beautyRetailers = ['Sephora', 'Holland & Barrett'];
        const beautyStartUrls = startUrls.filter(u => beautyRetailers.includes(u.userData.retailer));
        const sainsburysStartUrls = startUrls.filter(u => u.userData.retailer === "Sainsbury's" || u.userData.retailer === "Sainsburys");
        const asdaStartUrls = startUrls.filter(u => u.userData.retailer === 'Asda');
        const morrisonsStartUrls = startUrls.filter(u => u.userData.retailer === 'Morrisons');
        const ocadoStartUrls = startUrls.filter(u => u.userData.retailer === 'Ocado');
        const normalStartUrls = startUrls.filter(u => 
            u.userData.retailer !== 'Tesco' && 
            !beautyRetailers.includes(u.userData.retailer) && 
            u.userData.retailer !== "Sainsbury's" && 
            u.userData.retailer !== "Sainsburys" &&
            u.userData.retailer !== "Asda" &&
            u.userData.retailer !== "Morrisons" &&
            u.userData.retailer !== "Ocado"
        );

        if (tescoStartUrls.length > 0) {
          const run = await client.actor('apify/puppeteer-scraper').start({
            startUrls: tescoStartUrls,
            pageFunction: TESCO_RESILIENT_FUNCTION,
            proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'], countryCode: 'GB' },
            useStealth: true,
            useChrome: true,
            maxConcurrency: 1,
            requestHandlerTimeoutSecs: 600,
            pageFunctionTimeoutSecs: 600,
            handlePageTimeoutSecs: 600,
            navigationTimeoutSecs: 120
          }, {
            webhooks: [{ eventTypes: ['ACTOR.RUN.SUCCEEDED'], requestUrl: webhookUrl + '&source=puppeteer-tesco' }]
          });
          runs.push({ id: run.id, actor: 'puppeteer-scraper-tesco', retailers: ['Tesco'] });
        }

        if (sainsburysStartUrls.length > 0) {
          console.log('Starting Sainsbury\'s Dedicated Scraper...');
          const run = await client.actor('apify/puppeteer-scraper').start({
            startUrls: sainsburysStartUrls,
            pageFunction: SAINSBURYS_STABLE_PAGE_FUNCTION,
            proxyConfiguration: { 
              useApifyProxy: true, 
              apifyProxyGroups: ['RESIDENTIAL'], 
              countryCode: 'GB' 
            },
            useStealth: true,
            useChrome: true
          }, {
            webhooks: [{ eventTypes: ['ACTOR.RUN.SUCCEEDED'], requestUrl: webhookUrl + '&source=puppeteer-sainsburys' }]
          });
          runs.push({ id: run.id, actor: 'puppeteer-scraper-sainsburys', retailers: ["Sainsbury's"] });
        }

        if (beautyStartUrls.length > 0) {
          console.log('Starting Beauty Puppeteer Scraper (April 13th Stable Logic)...');
          const run = await client.actor('apify/puppeteer-scraper').start({
            startUrls: beautyStartUrls,
            pageFunction: BEAUTY_STABLE_PAGE_FUNCTION,
            proxyConfiguration: { 
              useApifyProxy: true, 
              apifyProxyGroups: ['RESIDENTIAL'], 
              countryCode: 'GB' 
            },
            useStealth: true,
            useChrome: true
          }, {
            webhooks: [{ eventTypes: ['ACTOR.RUN.SUCCEEDED'], requestUrl: webhookUrl + '&source=puppeteer-beauty' }]
          });
          runs.push({ id: run.id, actor: 'puppeteer-scraper-beauty', retailers: beautyStartUrls.map(u => u.userData.retailer) });
        }

        if (asdaStartUrls.length > 0) {
          console.log('Starting Asda Puppeteer Scraper (Specialized Logic)...');
          const run = await client.actor('apify/puppeteer-scraper').start({
            startUrls: asdaStartUrls,
            pageFunction: ASDA_STABLE_PAGE_FUNCTION,
            proxyConfiguration: { 
              useApifyProxy: true, 
              apifyProxyGroups: ['RESIDENTIAL'], 
              countryCode: 'GB' 
            },
            useStealth: true,
            useChrome: true,
            requestHandlerTimeoutSecs: 600,
            pageFunctionTimeoutSecs: 600,
            handlePageTimeoutSecs: 600,
            navigationTimeoutSecs: 120
          }, {
            webhooks: [{ eventTypes: ['ACTOR.RUN.SUCCEEDED'], requestUrl: webhookUrl + '&source=puppeteer-asda' }]
          });
          runs.push({ id: run.id, actor: 'puppeteer-scraper-asda', retailers: ["Asda"] });
        }

        if (morrisonsStartUrls.length > 0) {
          console.log('Starting Morrisons Fast Scraper...');
          const run = await client.actor('apify/puppeteer-scraper').start({
            startUrls: morrisonsStartUrls,
            pageFunction: MORRISONS_STABLE_PAGE_FUNCTION,
            proxyConfiguration: { useApifyProxy: true },
            useStealth: true,
            useChrome: true,
            requestHandlerTimeoutSecs: 300,
            pageFunctionTimeoutSecs: 300
          }, {
            webhooks: [{ eventTypes: ['ACTOR.RUN.SUCCEEDED'], requestUrl: webhookUrl + '&source=puppeteer-morrisons' }]
          });
          runs.push({ id: run.id, actor: 'puppeteer-scraper-morrisons', retailers: ["Morrisons"] });
        }

        if (ocadoStartUrls.length > 0) {
          console.log('Starting Ocado Fast Scraper...');
          const run = await client.actor('apify/puppeteer-scraper').start({
            startUrls: ocadoStartUrls,
            pageFunction: OCADO_STABLE_PAGE_FUNCTION,
            proxyConfiguration: { useApifyProxy: true },
            useStealth: true,
            useChrome: true,
            requestHandlerTimeoutSecs: 300,
            pageFunctionTimeoutSecs: 300
          }, {
            webhooks: [{ eventTypes: ['ACTOR.RUN.SUCCEEDED'], requestUrl: webhookUrl + '&source=puppeteer-ocado' }]
          });
          runs.push({ id: run.id, actor: 'puppeteer-scraper-ocado', retailers: ["Ocado"] });
        }

        if (normalStartUrls.length > 0) {
          const run = await client.actor('apify/puppeteer-scraper').start({
            startUrls: normalStartUrls,
            pageFunction: STABLE_PAGE_FUNCTION,
            proxyConfiguration: { useApifyProxy: true },
            useStealth: true,
            useChrome: true
          }, {
            webhooks: [{ eventTypes: ['ACTOR.RUN.SUCCEEDED'], requestUrl: webhookUrl + '&source=puppeteer-stable' }]
          });
          runs.push({ id: run.id, actor: 'puppeteer-scraper-stable', retailers: normalStartUrls.map(u => u.userData.retailer) });
        }
      }
    }

    if (runs.length === 0) {
      return response.status(400).json({ error: 'No scrapers triggered.', debug: { retailers } });
    }

    // Prioritize tracking the 'normal' run for the dashboard status
    const primaryRun = runs.length > 0 ? (runs.find(r => r.actor === 'puppeteer-scraper-stable') || runs[0]) : null;

    if (!primaryRun) {
        return response.status(400).json({ error: 'No scrapers could be started.', debug: { retailers, runs } });
    }

    return response.status(200).json({
      message: "Triggered " + runs.length + " runs",
      runId: primaryRun.id,
      runs,
      debug: { ecommerceRetailersToScrape, puppeteerRetailersToScrape }
    });
  } catch (error) {
    console.error('Fatal Error:', error);
    return response.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
