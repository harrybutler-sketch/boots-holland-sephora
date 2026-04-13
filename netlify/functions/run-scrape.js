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
    const ecommerceMap = {};

    const groceryUrls = {
      'Tesco': 'https://www.tesco.com/groceries/en-GB/shop/drinks/all?sortBy=relevance&facetsArgs=new%3Atrue&count=24',
      'Asda': 'https://www.asda.com/groceries/event/new-chilled-food'
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
          'https://www.sainsburys.co.uk/gol-ui/features/new-in-chilled/other:new'
        ];
        sainsburyUrls.forEach(url => startUrls.push({ url, userData: { retailer: 'Sainsburys', label: 'LISTING' } }));
      }
      if (pRetailers.some(r => r.includes('waitrose'))) {
        startUrls.push({ url: 'https://www.waitrose.com/ecom/shop/browse/groceries/new/food_cupboard?srsltid=AfmBOooUAwOW7wXkUHchXKjjmAIjgKfBr6fCmfdR9jXjAnAVBsaF-GqN', userData: { retailer: 'Waitrose', label: 'LISTING' } });
      }
      if (pRetailers.some(r => r.includes('morrisons'))) {
        const morrisonsUrls = [
          'https://groceries.morrisons.com/categories/fresh-chilled-foods/176739?boolean=new&sortBy=favorite'
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
        startUrls.push({ url: 'https://www.asda.com/groceries/event/new-chilled-food', userData: { retailer: 'Asda', label: 'LISTING' } });
      }
      if (pRetailers.some(r => r.includes('superdrug'))) {
        startUrls.push({ url: 'https://www.superdrug.com/new-in/c/new', userData: { retailer: 'Superdrug', label: 'LISTING' } });
      }

      if (startUrls.length > 0) {
        console.log('Starting Puppeteer Scraper...');
        
        const STABLE_PAGE_FUNCTION = `async ({ page, request, log, enqueueLinks, response }) => {
            const { url, userData: { retailer, label } } = request;
            
            if (label === 'LISTING') {
                log.info('Scraping listing: ' + url + ' (' + retailer + ')');
                const selectors = {
                    'Sainsburys': '.pt__link, a[href*="/gol-ui/product/"], a[href*="/product/"]',
                    'Waitrose': 'a[href*="/ecom/products/"]',
                    'Morrisons': 'a[href*="/products/"]',
                    'Ocado': 'a[href*="/products/"]',
                    'Asda': 'a[href*="/product/"]',
                    'Boots': 'a[href*="/product/"], a[href*="/p/"]',
                    'Superdrug': 'a[href*="/p/"]',
                    'Sephora': 'a[href*="/p/"]',
                    'Holland & Barrett': 'a[href*="/shop/product/"]'
                };
                const selector = selectors[retailer] || 'a[href*="/product/"], a[href*="/p/"]';
                
                await page.waitForSelector(selector, { timeout: 30000 }).catch(e => log.info('Timeout of selector: ' + selector));
                
                const nextSelectors = {
                    'Sainsburys': 'a[aria-label="Next page"]',
                    'Waitrose': 'a[aria-label="Next page"]',
                    'Morrisons': 'a.next-page, a[aria-label*="Next"]',
                    'Ocado': 'a.next-page',
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
                const delay = 2000 + (Math.random() * 3000);
                await new Promise(r => setTimeout(r, delay));
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
                const isOwnBrand = ownBrandKeywords.some(kw => results.product_name.toLowerCase().includes(kw.toLowerCase()));
                
                if (isOwnBrand) {
                    log.info('Skipping Own Brand: ' + results.product_name);
                    return null;
                }
                if (results.reviews > 5) {
                    log.info('Skipping High Reviews (' + results.reviews + '): ' + results.product_name);
                    return null;
                }

                return results;
            }
        }`;

        const TESCO_AGGRESSIVE_FUNCTION = `async ({ page, request, log, enqueueLinks, response }) => {
            const { url, userData: { retailer, label } } = request;
            
            // Stealth: Desktop Viewport
            await page.setViewport({ width: 1920, height: 1080 });

            // Stealth: Cookie Acceptance
            try {
                const cookieButton = await page.$('#onetrust-accept-btn-handler');
                if (cookieButton) {
                    log.info('Clearing Tesco cookie banner...');
                    await page.evaluate((el) => el.click(), cookieButton);
                    await new Promise(r => setTimeout(r, 1000));
                }
            } catch (e) {
                log.info('Non-critical: Could not click cookie banner.');
            }

            // Wait for products to load (using a more resilient title-based selector)
            await page.waitForSelector('a[class*="titleLink"], li.product-list--list-item', { timeout: 30000 });
            
            // Extract all products from this listing page
            const products = await page.evaluate(() => {
                const titleLinks = Array.from(document.querySelectorAll('a[class*="titleLink"]'));
                // Map from titles to their parent containers to ensure we get one result per product
                return titleLinks.map(nameEl => {
                    const tile = nameEl.closest('div[class*="ProductTile"], li, div');
                    const priceEl = tile.querySelector('[data-testid="unit-price"], .price, [class*="price-details"]');
                    const imgEl = tile.querySelector('img[class*="product-image"], img');
                    const reviewEl = tile.querySelector('span[class*="review-count"], [class*="review-count"]');
                    
                    const name = nameEl?.innerText?.trim() || 'N/A';
                    const res = {
                        product_name: name,
                        retailer: 'Tesco',
                        price_display: priceEl?.innerText?.trim() || 'N/A',
                        reviews: 0,
                        rating: '0.0',
                        image_url: imgEl?.src || '',
                        product_url: nameEl?.href || window.location.href,
                        manufacturer: name.split(' ')[0],
                        manufacturer_address: 'N/A',
                        date_found: new Date().toISOString()
                    };
                    
                    if (reviewEl) {
                        const rText = reviewEl.innerText;
                        const match = rText.match(/\\d+/);
                        if (match) res.reviews = parseInt(match[0]) || 0;
                        const ratingMatch = rText.match(/(\\d+\\.\\d+)/);
                        if (ratingMatch) res.rating = ratingMatch[1];
                    }
                    return res;
                });
            });

            // Filtering: own-brand and max 5 reviews
            const filtered = products.filter(p => {
                const isOwnBrand = p.product_name.toLowerCase().includes('tesco');
                return p.reviews <= 5 && !isOwnBrand;
            });

            log.info(\`Extracted \${filtered.length} products from \${url}\`);
            
            // Pagination: only for LISTING
            await enqueueLinks({ selector: 'a[aria-label*="next page"], a.pagination--button--next', label: 'LISTING', userData: { retailer: 'Tesco' } });

            // Returning an array saves each element as a separate result
            return filtered;
        }`;

        // Separate Start URLs: Tesco vs The Rest
        const tescoStartUrls = startUrls.filter(u => u.userData.retailer === 'Tesco');
        const normalStartUrls = startUrls.filter(u => u.userData.retailer !== 'Tesco');

        if (tescoStartUrls.length > 0) {
          const run = await client.actor('apify/puppeteer-scraper').start({
            startUrls: tescoStartUrls,
            pageFunction: TESCO_AGGRESSIVE_FUNCTION,
            proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'], countryCode: 'GB' },
            useStealth: true,
            useChrome: true,
            maxConcurrency: 1
          }, {
            webhooks: [{ eventTypes: ['ACTOR.RUN.SUCCEEDED'], requestUrl: webhookUrl + '&source=puppeteer-tesco' }]
          });
          runs.push({ id: run.id, actor: 'puppeteer-scraper-tesco', retailers: ['Tesco'] });
        }

        if (normalStartUrls.length > 0) {
          const run = await client.actor('apify/puppeteer-scraper').start({
            startUrls: normalStartUrls,
            pageFunction: STABLE_PAGE_FUNCTION,
            proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'], countryCode: 'GB' },
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
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No scrapers triggered.', debug: { retailers } })
      };
    }

    // Prioritize tracking the 'normal' run for the dashboard status
    const primaryRun = runs.find(r => r.actor === 'puppeteer-scraper-stable') || runs[0];

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Triggered ${runs.length} runs`,
        runId: primaryRun.id,
        runs,
        debug: { ecommerceRetailersToScrape, puppeteerRetailersToScrape }
      })
    };
  } catch (error) {
    console.error('Fatal Error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Internal Server Error' }) };
  }
};
