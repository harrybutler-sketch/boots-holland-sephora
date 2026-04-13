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
      'Tesco': 'https://www.tesco.com/groceries/en-GB/shop/drinks/all?viewAll=new&new=new',
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
            useApifyProxy: true, 
            apifyProxyGroups: ['RESIDENTIAL'], 
            countryCode: 'GB' 
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
          'https://www.tesco.com/groceries/en-GB/shop/drinks/all?viewAll=new&new=new'
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

        const TESCO_RESILIENT_FUNCTION = `async ({ page, request, log, enqueueLinks, response }) => {
            const { url, userData: { retailer, label } } = request;
            
            // 1. Desktop Stealth Headers
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
            await page.setViewport({ width: 1920, height: 1080 });

            // 2. Initial Block Check (Akamai/PerimeterX)
            if (response && (response.status === 403 || response.status === 429)) {
                log.error('Tesco Hardware Block (403/429). Rotating Proxy...');
                throw new Error('Tesco Block (Status ' + response.status + '). Rotating proxy...');
            }

            // 3. Human Mimicry: Initial Delay
            const thinkTime = Math.floor(Math.random() * 4000) + 3000;
            log.info(\`Mimicking human thinking for \${thinkTime}ms...\`);
            await new Promise(r => setTimeout(r, thinkTime));

            // 4. Content Check & Stealth Block Detection
            const blockInfo = await page.evaluate(() => {
                const h1El = document.querySelector('h1');
                const h1 = h1El ? h1El.innerText.trim() : '';
                const title = document.title || '';
                const body = document.body ? document.body.innerText : '';
                return {
                    isOops: h1.toLowerCase().includes('oops') || h1.toLowerCase().includes('not down this aisle') || title.toLowerCase().includes('access denied') || body.toLowerCase().includes("it's not you, it's us"),
                    h1, title
                };
            });

            // 5. Session Warming (Final resort bypass)
            if (blockInfo.isOops || !url.includes('groceries')) {
                log.info('Warming Session: Hitting homepage first...');
                await page.goto('https://www.tesco.com/groceries/en-GB/', { waitUntil: 'networkidle2', timeout: 30000 }).catch(e => log.warning('Warming failed: ' + e.message));
                await new Promise(r => setTimeout(r, 2000));
                log.info('Session Warmed. Retrying category: ' + url);
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            }

            // 6. Explicit MFE Hydration
            log.info('Waiting for product grid hydration...');
            await page.evaluate(() => window.scrollBy(0, 800));
            // Use stable generic classes to wait for the grid
            await page.waitForSelector('a[class*="titleLink"], a[href*="/products/"]', { timeout: 20000 }).catch(() => log.warning('Product grid timed out.'));
            await new Promise(r => setTimeout(r, 3000));

            // 7. Extraction via DOM
            log.info('Extracting products from DOM...');
            const products = await page.evaluate(() => {
                let titleLinks = Array.from(document.querySelectorAll('a[class*="titleLink"]'));
                
                // Fallback if titleLink class is entirely changed
                if (titleLinks.length === 0) {
                    titleLinks = Array.from(document.querySelectorAll('a[href*="/products/"]'))
                        .filter(a => a.innerText.trim().length > 5);
                }

                return titleLinks.map(nameEl => {
                    const tile = nameEl.closest('li, div[class*="ProductTile"], [data-testid="product-tile"], article, div[class*="tile"], div.product-details');
                    const priceEl = tile?.querySelector('p.ddsweb-price--primary, [data-testid="unit-price"], .price, .ddsweb-price__text, [class*="price"]');
                    const imgEl = tile?.querySelector('img[class*="product-image"], a[class*="imageContainer"] img, img');
                    const reviewEl = tile?.querySelector('div.ddsweb-star-rating, [data-testid="reviews-count"], [class*="review-count"], span[class*="Rating"]');
                    
                    const name = nameEl?.innerText?.trim() || 'N/A';
                    if (name === 'N/A' || name.length < 3) return null;

                    // Improved price extraction
                    let price = priceEl?.innerText?.trim() || 'N/A';
                    if (price === 'N/A' && tile) {
                        const allP = Array.from(tile.querySelectorAll('p, span, div'));
                        const pMatch = allP.find(p => p.innerText.includes('£'));
                        if (pMatch) price = pMatch.innerText.trim();
                    }

                    const res = {
                        product_name: name,
                        retailer: 'Tesco',
                        price_display: price,
                        reviews: 0,
                        rating: '0.0',
                        image_url: imgEl?.src || '',
                        product_url: nameEl?.href || window.location.href,
                        manufacturer: name.split(' ')[0],
                        date_found: new Date().toISOString()
                    };
                    
                    if (reviewEl) {
                        const rText = reviewEl.innerText;
                        const match = rText.match(/(\d+)/);
                        if (match) res.reviews = parseInt(match[0]) || 0;
                        const ratingMatch = rText.match(/(\d+\.\d+)/);
                        if (ratingMatch) res.rating = ratingMatch[1];
                    }
                    return res;
                }).filter(Boolean);
            });

            if (!products || products.length === 0) {
                log.warning('No products found on page. DOM might not have loaded or layout changed.');
                return [];
            }

            // 7. Filter
            const filtered = products.filter(p => {
                const ln = p.product_name.toLowerCase();
                const isOwnBrand = ln.includes('tesco') || ln.includes('finest') || ln.includes('stockwell') || ln.includes('ms molly') || ln.includes('hearty food') || ln.includes('grower');
                return p.reviews <= 5 && !isOwnBrand;
            });

            log.info(\`Extracted \${filtered.length} products (found \${products.length} total)\`);
            
            // 8. Pagination
            await enqueueLinks({ 
                selector: 'a[aria-label*="next page"], a.pagination--button--next, [data-testid="pagination-next"]', 
                label: 'LISTING', 
                userData: { retailer: 'Tesco' } 
            }).catch(() => {});

            return filtered;
        }`;

        // Separate Start URLs: Tesco vs The Rest
        const tescoStartUrls = startUrls.filter(u => u.userData.retailer === 'Tesco');
        const normalStartUrls = startUrls.filter(u => u.userData.retailer !== 'Tesco');

        if (tescoStartUrls.length > 0) {
          const run = await client.actor('apify/puppeteer-scraper').start({
            startUrls: tescoStartUrls,
            pageFunction: TESCO_RESILIENT_FUNCTION,
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
