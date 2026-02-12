const { ApifyClient } = require('apify-client');

exports.handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { retailers, mode } = JSON.parse(event.body);

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
    // Hardcoded logic from previous version to ensure no regression
    // Beauty Workspace URLs:
    if (retailers.includes('Sephora')) {
      startUrls.push({
        url: 'https://www.sephora.co.uk/new-at-sephora?srsltid=AfmBOookMPw5VCcz6Fai1EHtuFe6ajRPCD-ySREKZS6gnvu2ECZBITWv&filter=fh_location=//c1/en_GB/in_stock%3E{in}/new_in=1/!exclude_countries%3E{gb}/!site_exclude%3E{79}/!brand=a70/%26device=desktop%26site_area=cms%26date_time=20260207T101506%26fh_view_size=40%26fh_start_index=0%26fh_view_size=120',
        userData: { retailer: 'Sephora' },
      });
    }
    if (retailers.includes('Holland & Barrett')) {
      startUrls.push({
        url: 'https://www.hollandandbarrett.com/shop/health-wellness/?t=is_new%3Atrue',
        userData: { retailer: 'Holland & Barrett' },
      });
      startUrls.push({
        url: 'https://www.hollandandbarrett.com/shop/natural-beauty/natural-beauty-shop-all/?t=is_new%3Atrue',
        userData: { retailer: 'Holland & Barrett' },
      });
      startUrls.push({
        url: 'https://www.hollandandbarrett.com/shop/highlights/new-in/?page=5',
        userData: { retailer: 'Holland & Barrett' },
      });
    }
    if (retailers.includes('Boots')) {
      startUrls.push({
        url: 'https://www.boots.com/new-to-boots',
        userData: { retailer: 'Boots' },
      });
    }
    if (retailers.includes('Superdrug')) {
      startUrls.push({
        url: 'https://www.superdrug.com/new-in/c/new',
        userData: { retailer: 'Superdrug' },
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
        startUrls.push({ url: groceryMap[retailer], userData: { retailer } });
      }
    });

    // Split logic: H&B vs Others
    const hbUrls = startUrls.filter(u => u.userData.retailer === 'Holland & Barrett');
    const otherUrls = startUrls.filter(u => u.userData.retailer !== 'Holland & Barrett');

    let runId = null;
    let runStatusUrl = null;
    let startedAt = null;

    // 1. Run Standard Scraper for non-H&B
    if (otherUrls.length > 0) {
      console.log(`Starting standard scrape for ${otherUrls.length} URLs`);
      const run = await client.actor(process.env.APIFY_ACTOR_ID).start({
        listingUrls: otherUrls,
        scrapeMode: 'BROWSER',
        maxProductResults: otherUrls.length * 150, // Approximate limit
        proxyConfiguration: { useApifyProxy: true },
        countryCode: 'US'
      });
      runId = run.id;
      runStatusUrl = run.statusUrl;
      startedAt = run.startedAt;
    }

    // 2. Run Custom Puppeteer Scraper for H&B (if requested)
    if (hbUrls.length > 0) {
      console.log(`Starting custom H&B scrape for ${hbUrls.length} URLs`);

      // Add LISTING label
      const hbStartUrls = hbUrls.map(u => ({ ...u, userData: { ...u.userData, label: 'LISTING' } }));

      // Callback URL for sync
      const webhookUrl = `https://${event.headers.host}/.netlify/functions/run-status`;

      const run = await client.actor('apify/puppeteer-scraper').start({
        startUrls: hbStartUrls,
        proxyConfiguration: { useApifyProxy: true },
        maxPagesPerCrawl: 150, // Limit for H&B
        // Page Function (Combined Listing + Detail logic)
        pageFunction: `async function pageFunction(context) {
                const { page, request, log, enqueueLinks } = context;
                
                if (request.userData.label === 'LISTING') {
                    // Browsing "New In" listing
                    log.info('Listing page: ' + request.url);
                    
                    // Lazy load scroll
                    await page.evaluate(async () => {
                        await new Promise((resolve) => {
                            let totalHeight = 0;
                            const distance = 100;
                            let scrolls = 0;
                            const timer = setInterval(() => {
                                window.scrollBy(0, distance);
                                totalHeight += distance;
                                scrolls++;
                                if (scrolls > 50) { clearInterval(timer); resolve(); }
                            }, 100);
                        });
                    });
                    
                    // Enqueue Product Links
                    await enqueueLinks({
                        selector: 'a[href*="/shop/product/"]',
                        label: 'DETAIL'
                    });
                     return { type: 'LISTING', url: request.url };
                } else {
                    // Extract Product Data (LD-JSON)
                    log.info('Product page: ' + request.url);
                    
                    // Wait for LD-JSON
                    try {
                        await page.waitForSelector('script[type="application/ld+json"]', { timeout: 10000 });
                    } catch(e) { log.warning('No LD-JSON found'); }
                    
                    const jsonLd = await page.evaluate(() => {
                        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
                        return scripts.map(s => { try { return JSON.parse(s.innerText); } catch(e) { return null; } }).filter(Boolean);
                    });

                    // Flatten for run-status.js
                    let item = { url: request.url };
                    if (jsonLd && jsonLd.length > 0) {
                        const product = jsonLd.find(i => i['@type'] === 'Product');
                        if (product) {
                            item.name = product.name;
                            item.brand = typeof product.brand === 'object' ? product.brand.name : product.brand;
                            item.image = Array.isArray(product.image) ? product.image[0] : product.image;
                            item.description = product.description;
                            item.sku = product.sku || product.mpn;
                            if (product.offers) {
                                const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
                                item.price = offer.price;
                                item.currency = offer.priceCurrency;
                            }
                            if (product.aggregateRating) {
                                item.rating = product.aggregateRating.ratingValue;
                                item.reviews = product.aggregateRating.reviewCount;
                            }
                        }
                    } else { item.name = await page.title(); }
                    
                    return item;
                }
            }`,
        // Webhook for sync
        webhooks: [
          {
            eventTypes: ['ACTOR.RUN.SUCCEEDED'],
            requestUrl: webhookUrl
          }
        ]
      });

      // Prioritize returning the H&B run ID if it runs, as user is likely debugging H&B
      runId = run.id;
      runStatusUrl = run.statusUrl;
      startedAt = run.startedAt;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        runId,
        statusUrl: runStatusUrl,
        startedAt,
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
