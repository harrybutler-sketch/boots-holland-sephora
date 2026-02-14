const { ApifyClient } = require('apify-client');

exports.handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { retailers, mode, workspace } = JSON.parse(event.body);

    if (!retailers || !Array.isArray(retailers) || retailers.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Retailers list is required' }),
      };
    }

    const client = new ApifyClient({
      token: process.env.APIFY_TOKEN,
    });

    // Helper to get start URL for a retailer
    const getScrapeConfig = (retailer) => {
      // ... (Keep existing URL logic roughly)
      // Since strict URL mapping is complex to copy-paste, I will rely on reading the original file content
      // But for safety I will reconstruct it based on the previous view_file content (Step 995)
      // I will implement the URL mapping map directly here
    };

    // Construct Start URLs for all retailers
    const startUrls = [];

    // Beauty Workspace URLs:
    if (retailers.includes('Sephora')) {
      startUrls.push({
        url: 'https://www.sephora.co.uk/new-at-sephora',
        userData: { retailer: 'Sephora', label: 'LISTING' },
      });
    }
    if (retailers.includes('Holland & Barrett')) {
      startUrls.push({
        url: 'https://www.hollandandbarrett.com/shop/health-wellness/?t=is_new%3Atrue',
        userData: { retailer: 'Holland & Barrett', label: 'LISTING' },
      });
      startUrls.push({
        url: 'https://www.hollandandbarrett.com/shop/natural-beauty/natural-beauty-shop-all/?t=is_new%3Atrue',
        userData: { retailer: 'Holland & Barrett', label: 'LISTING' },
      });
    }
    if (retailers.includes('Boots')) {
      startUrls.push({
        url: 'https://www.boots.com/new-to-boots',
        userData: { retailer: 'Boots', label: 'LISTING' },
      });
    }
    if (retailers.includes('Superdrug')) {
      startUrls.push({
        url: 'https://www.superdrug.com/new-in/c/new',
        userData: { retailer: 'Superdrug', label: 'LISTING' },
      });
    }

    // Grocery workspace map
    const groceryMap = {
      'Sainsburys': 'https://www.sainsburys.co.uk/gol-ui/features/new-in',
      'Tesco': 'https://www.tesco.com/groceries/en-GB/search?query=new%20in',
      'Asda': 'https://groceries.asda.com/search/new%20in',
      'Morrisons': 'https://groceries.morrisons.com/categories/new/192077',
      'Ocado': 'https://www.ocado.com/search?entry=new%20in',
      'Waitrose': 'https://www.waitrose.com/ecom/shop/browse/groceries/new'
    };

    retailers.forEach(retailer => {
      if (groceryMap[retailer]) {
        startUrls.push({ url: groceryMap[retailer], userData: { retailer, label: 'LISTING' } });
      }
    });

    if (startUrls.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No valid retailers found' }) };
    }

    console.log(`Starting universal custom scrape for ${startUrls.length} start URLs`);

    // Determine if we need residential proxies based on retailers
    // These retailers have stricter anti-bot protection and need residential proxies
    const strictRetailers = ['Sephora', 'Boots', 'Tesco', 'Sainsburys', 'Asda'];
    const needsResidentialProxy = retailers.some(r => strictRetailers.includes(r));

    // Callback URL for sync
    // Callback URL for sync (pass workspace context)
    const webhookUrl = `https://${event.headers.host}/.netlify/functions/run-status?workspace=${workspace || 'beauty'}`;

    const run = await client.actor('apify/puppeteer-scraper').start({
      startUrls,
      proxyConfiguration: {
        useApifyProxy: true,
        ...(needsResidentialProxy && { apifyProxyGroups: ['RESIDENTIAL'] }) // Use residential proxies only for strict retailers
      },
      useChrome: true,
      stealth: true,
      maxPagesPerCrawl: 200, // Increased limit to find more products
      maxConcurrency: 1, // Crawl one page at a time to avoid detection
      maxRequestRetries: 5, // Increase retries
      navigationTimeoutSecs: 180,
      pageLoadTimeoutSecs: 180,
      // Add delay between requests to appear more human-like
      minConcurrency: 1,
      maxRequestsPerCrawl: 200, // Increased to match maxPagesPerCrawl
      // Custom browser launch options for better stealth
      launchOptions: {
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-web-security'
        ]
      },
      // Pre-navigation hook to mask automation signals
      preNavigationHooks: `[
        async ({ page, request }) => {
          const retailer = request.userData.retailer;
          
          // Set realistic viewport
          await page.setViewport({ width: 1920, height: 1080 });
          
          // Set realistic user agent
          await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
          
          // Set realistic headers
          await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0'
          });
          
          // Override navigator properties to hide automation
          await page.evaluateOnNewDocument(() => {
            // Hide webdriver
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            
            // Mock plugins
            Object.defineProperty(navigator, 'plugins', { 
              get: () => [
                { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
                { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
              ] 
            });
            
            // Set realistic languages
            Object.defineProperty(navigator, 'languages', { get: () => ['en-GB', 'en-US', 'en'] });
            
            // Mock chrome object
            window.chrome = { 
              runtime: {},
              loadTimes: function() {},
              csi: function() {},
              app: {}
            };
            
            // Override permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
              parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
            );
            
            // Add realistic hardware concurrency
            Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
            
            // Add realistic device memory
            Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
            
            // Mock battery API
            Object.defineProperty(navigator, 'getBattery', { 
              get: () => () => Promise.resolve({
                charging: true,
                chargingTime: 0,
                dischargingTime: Infinity,
                level: 1
              })
            });
          });
          
          // Retailer-specific delays (longer for strict retailers)
          const strictRetailers = ['Tesco', 'Sainsburys', 'Asda', 'Sephora', 'Boots'];
          const delay = strictRetailers.includes(retailer) 
            ? 3000 + Math.random() * 4000  // 3-7 seconds for strict retailers
            : 1000 + Math.random() * 2000; // 1-3 seconds for others
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      ]`,
      pageFunction: `async function pageFunction(context) {
                const { page, request, log, enqueueLinks } = context;
                const { label, retailer } = request.userData;
                
                // Retailer-specific delays (longer for strict retailers)
                const strictRetailers = ['Tesco', 'Sainsburys', 'Asda', 'Sephora', 'Boots'];
                const pageDelay = strictRetailers.includes(retailer)
                    ? 4000 + Math.random() * 4000  // 4-8 seconds for strict retailers
                    : 2000 + Math.random() * 2000; // 2-4 seconds for others
                
                await new Promise(r => setTimeout(r, pageDelay));
                
                if (label === 'LISTING') {
                    log.info(\`Listing page (\${retailer}): \` + request.url);
                    
                    // Lazy load scroll - slower and more human-like
                    await page.evaluate(async () => {
                        await new Promise((resolve) => {
                            let totalHeight = 0;
                            const distance = 150; // Larger scroll distance
                            let scrolls = 0;
                            const timer = setInterval(() => {
                                window.scrollBy(0, distance);
                                totalHeight += distance;
                                scrolls++;
                                if (scrolls > 50) { clearInterval(timer); resolve(); } // Increased scrolls to load more products
                            }, 200); // Slower scroll speed (200ms instead of 100ms)
                        });
                    });
                    
                    // Selector Map for Product Links
                    const selectors = {
                        'Holland & Barrett': 'a[href*="/shop/product/"]',
                        'Sephora': 'a.Product-link',
                        'Boots': 'a.oct-teaser-wrapper-link, a.oct-teaser__title-link',
                        'Superdrug': 'a.cx-product-name, a.product-image-container',
                        'Tesco': 'a[data-testid="product-image-link"]',
                        'Sainsburys': 'a.pt__link-wrapper, a.pt__link',
                        'Asda': 'a.co-item__title-link',
                        'Morrisons': 'a[href*="/products/"]',
                        'Ocado': 'a[href*="/products/"]',
                        'Waitrose': 'a[href*="/ecom/products/"]'
                    };
                    
                    const selector = selectors[retailer] || 'a[href*="/product/"], a[href*="/p/"]';
                    
                    // Enqueue product links
                    await enqueueLinks({
                        selector,
                        label: 'DETAIL',
                        userData: { retailer }
                    });
                    
                    // Also enqueue pagination links to get more products from additional pages
                    await enqueueLinks({
                        selector: 'a[rel="next"], a.pagination__next, a[aria-label*="Next"], button[aria-label*="Next"], a.next',
                        label: 'LISTING',
                        userData: { retailer }
                    });
                     return { type: 'LISTING', url: request.url, retailer };
                } else {
                    // Extract Product Data
                    log.info(\`Product page (\${retailer}): \` + request.url);
                    
                    // Wait for dynamic content
                    await new Promise(r => setTimeout(r, 5000));
                    
                    const item = await page.evaluate((retailer) => {
                        const results = { 
                            url: window.location.href,
                            retailer: retailer,
                            name: document.title,
                            reviews: 0,
                            rating: 0
                        };
                        
                        // 1. JSON-LD Extraction
                        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
                        for (const s of scripts) {
                            try {
                                const json = JSON.parse(s.innerText);
                                const products = Array.isArray(json) ? json : [json];
                                const product = products.find(i => i['@type'] === 'Product' || (i['@graph'] && i['@graph'].find(g => g['@type'] === 'Product')));
                                const p = product && product['@graph'] ? product['@graph'].find(g => g['@type'] === 'Product') : product;
                                
                                if (p) {
                                    results.name = p.name || results.name;
                                    results.brand = typeof p.brand === 'object' ? p.brand.name : p.brand;
                                    results.image = Array.isArray(p.image) ? p.image[0] : p.image;
                                    results.description = p.description;
                                    results.sku = p.sku || p.mpn;
                                    
                                    if (p.offers) {
                                        const offer = Array.isArray(p.offers) ? p.offers[0] : p.offers;
                                        results.price = offer.price;
                                        results.currency = offer.priceCurrency;
                                    }
                                    
                                    const ratingObj = p.aggregateRating;
                                    if (ratingObj) {
                                        results.rating = parseFloat(ratingObj.ratingValue) || 0;
                                        results.reviews = parseInt(ratingObj.reviewCount || ratingObj.reviewsCount || ratingObj.numberOfReviews) || 0;
                                    }
                                }
                            } catch(e) {}
                        }
                        
                        // 2. DOM Fallbacks
                        if (results.reviews === 0) {
                            // Bazaarvoice (Sephora, Boots, Sainsbury's)
                            // Use specific selectors to avoid grabbing screen reader text
                            const bvRating = document.querySelector('.bv_avgRating, .bv_avgRating_component_container .bv_avgRating_text');
                            if (bvRating) {
                                results.rating = parseFloat(bvRating.innerText.trim()) || 0;
                            }
                            
                            // Get review count from specific element, not the entire button
                            const bvCount = document.querySelector('.bv_numReviews_text, .bv_numReviews');
                            if (bvCount) {
                                // Extract only the number inside parentheses if present, e.g., "(1)" -> "1"
                                const text = bvCount.innerText.trim();
                                const match = text.match(/\((\d+)\)/);
                                results.reviews = match ? parseInt(match[1]) : parseInt(text.replace(/[^0-9]/g, '')) || 0;
                            }
                            
                            // PowerReviews (Superdrug)
                            if (results.reviews === 0) {
                                const prCount = document.querySelector('.pr-snippet-review-count');
                                if (prCount) {
                                    results.reviews = parseInt(prCount.innerText.replace(/[^0-9]/g, '')) || 0;
                                    const prRating = document.querySelector('.pr-snippet-rating-decimal');
                                    if (prRating) results.rating = parseFloat(prRating.innerText) || 0;
                                }
                            }
                            
                            // Tesco/Generic Fallback (ARIA labels)
                            if (results.reviews === 0) {
                                const ariaRating = document.querySelector('[aria-label*="rating"], [aria-label*="stars"], .star-rating, [data-testid="stars-rating"]');
                                if (ariaRating) {
                                    const aria = ariaRating.getAttribute('aria-label') || '';
                                    const match = aria.match(/([0-9.]+)/);
                                    if (match) results.rating = parseFloat(match[1]);
                                    
                                    const reviewText = Array.from(document.querySelectorAll('a, span')).find(el => el.innerText.includes('Reviews') || el.innerText.includes('ratings'));
                                    if (reviewText) results.reviews = parseInt(reviewText.innerText.replace(/[^0-9]/g, '')) || 0;
                                }
                            }
                        }
                        
                        // 3. Own Brand Filtering (Save Credits)
                        const lowerName = results.name.toLowerCase();
                        const lowerBrand = (results.brand || '').toLowerCase();
                        const lowerRetailer = retailer.toLowerCase();
                        
                        const ownBrandMap = {
                            // Grocery Retailers
                            'Morrisons': ['morrisons', 'the best', 'savers', 'nutmeg', 'market street'],
                            'Tesco': ['tesco', 'stockwell', 'ms molly', 'eastman', 'finest', 'creamfields', 'grower\'s harvest'],
                            'Asda': ['asda', 'extra special', 'just essentials', 'george home'],
                            'Sainsburys': ['sainsbury', 'hubbard', 'stamford street'],
                            'Waitrose': ['waitrose', 'essential', 'duchy'],
                            'Ocado': ['ocado', 'm&s', 'marks & spencer'],
                            // Beauty Retailers
                            'Sephora': ['sephora collection', 'sephora'],
                            'Boots': ['boots', 'no7', 'no 7', 'botanics', 'soap & glory', 'soap and glory'],
                            'Holland & Barrett': ['holland & barrett', 'holland and barrett', 'h&b'],
                            'Superdrug': ['superdrug', 'b.', 'b. by superdrug']
                        };
                        
                        const keywords = ownBrandMap[retailer] || [];
                        
                        // Smart own-brand detection:
                        // 1. Check brand field first (most reliable)
                        // 2. If brand empty, check if name STARTS with keyword
                        // 3. Ignore "Boots" suffix artifacts in product names
                        
                        let isOwnBrand = false;
                        
                        // Primary check: brand field
                        if (lowerBrand) {
                            isOwnBrand = keywords.some(kw => lowerBrand.includes(kw));
                        }
                        
                        // Fallback: check if name STARTS with own-brand keyword (not just contains)
                        if (!isOwnBrand && !lowerBrand) {
                            const nameWords = lowerName.split(' ');
                            const firstWord = nameWords[0] || '';
                            const firstTwoWords = nameWords.slice(0, 2).join(' ');
                            
                            isOwnBrand = keywords.some(kw => {
                                return firstWord === kw || firstTwoWords.startsWith(kw) || lowerName.startsWith(kw);
                            });
                        }
                        
                        if (isOwnBrand) {
                            // Mark as skipped so we don't save it to dataset (and thus don't enrich it)
                            return { ...results, skipped: true, reason: 'OWN_BRAND' };
                        }

                        return results;
                    }, retailer);
                    
                    if (item.skipped) {
                        log.info(`Skipping own- brand item(${ item.reason }): ${ item.name }`);
                        return null; // Do not save to dataset which saves credits on enrichment
                    }
                    
                    // Filter by review count (0-5 reviews only - focus on emerging products)
                    if (item.reviews > 5) {
                        log.info(`Skipping high - review product(${ item.reviews } reviews): ${ item.name }`);
                        return null;
                    }
                    
                    return item;
                }
            }`,
    }, {
    webhooks: [
      {
        eventTypes: ['ACTOR.RUN.SUCCEEDED'],
        requestUrl: webhookUrl
      }
    ]
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      runId: run.id,
      statusUrl: run.statusUrl,
      startedAt: run.startedAt,
    }),
  };
} catch (error) {
  console.error('Error triggering scrape:', error);
  return {
    statusCode: 500,
    body: JSON.stringify({ error: `Failed to trigger scrape: ${error.message}` }),
  };
}
};
