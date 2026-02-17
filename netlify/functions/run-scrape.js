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
      'sainsburys': 'Sainsburys', 'sainsbury': 'Sainsburys', 'sainsbury\'s': 'Sainsburys',
      'tesco': 'Tesco', 'asda': 'Asda', 'superdrug': 'Superdrug'
    };

    const groceryUrls = {
      'Sainsburys': 'https://www.sainsburys.co.uk/gol-ui/features/new-in\nhttps://www.sainsburys.co.uk/shop/gb/groceries/get-ideas/new-products/all-new-products',
      'Tesco': 'https://www.tesco.com/groceries/en-GB/search?query=new%20in&icid=gh_hp_search_new%20in',
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
        const run = await client.actor('apify/e-commerce-scraping-tool').start({
          listingUrls: inputUrls.map(url => ({ url })),
          maxItems: 1000,
          proxyConfiguration: { useApifyProxy: true }
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
      if (pRetailers.some(r => r.includes('waitrose'))) {
        startUrls.push({ url: 'https://www.waitrose.com/ecom/shop/browse/groceries/new', userData: { retailer: 'Waitrose', label: 'LISTING' } });
      }
      if (pRetailers.some(r => r.includes('morrisons'))) {
        startUrls.push({ url: 'https://groceries.morrisons.com/categories/new/192077', userData: { retailer: 'Morrisons', label: 'LISTING' } });
      }
      if (pRetailers.some(r => r.includes('ocado'))) {
        startUrls.push({ url: 'https://www.ocado.com/browse/new-in-119934', userData: { retailer: 'Ocado', label: 'LISTING' } });
      }

      if (startUrls.length > 0) {
        console.log('Starting Puppeteer Scraper...');
        const run = await client.actor('apify/puppeteer-scraper').start({
          startUrls,
          useChrome: true,
          stealth: true,
          maxPagesPerCrawl: 400,
          proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'] },
          pageFunction: `async function pageFunction(context) {
                const { page, request, log, enqueueLinks } = context;
                const { label, retailer } = request.userData;
                
                if (label === 'LISTING') {
                    log.info(\`Listing page (\${retailer}): \` + request.url);
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
                    
                    const selectors = {
                        'Holland & Barrett': 'a[href*="/shop/product/"]',
                        'Sephora': 'a.Product-link',
                        'Boots': 'a.oct-teaser-wrapper-link, a.oct-teaser__title-link',
                        'Waitrose': 'a[href*="/ecom/products/"]',
                        'Ocado': 'a[href*="/products/"]',
                        'Morrisons': 'a[href*="/products/"]'
                    };
                    
                    const selector = selectors[retailer] || 'a[href*="/product/"], a[href*="/p/"]';
                    await enqueueLinks({ selector, label: 'DETAIL', userData: { retailer } });
                } else {
                    log.info(\`Product page (\${retailer}): \` + request.url);
                    await new Promise(r => setTimeout(r, 5000));
                    
                    return await page.evaluate((retailer) => {
                        const results = { url: window.location.href, retailer: retailer, name: document.title, reviews: 0 };
                        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
                        for (const s of scripts) {
                            try {
                                const json = JSON.parse(s.innerText);
                                const products = Array.isArray(json) ? json : [json];
                                const product = products.find(i => i['@type'] === 'Product' || (i['@graph'] && i['@graph'].find(g => g['@type'] === 'Product')));
                                const p = product && product['@graph'] ? product['@graph'].find(g => g['@type'] === 'Product') : product;
                                if (p && p.aggregateRating) {
                                    results.reviews = parseInt(p.aggregateRating.reviewCount || p.aggregateRating.numberOfReviews) || 0;
                                }
                            } catch(e) {}
                        }
                        if (results.reviews === 0) {
                            const bvCount = document.querySelector('.bv_numReviews_text, #bvRContainer-Link, [data-bv-show="rating_summary"]');
                            if (bvCount) results.reviews = parseInt(bvCount.innerText.replace(/[^0-9]/g, '')) || 0;
                        }
                        return results;
                    }, retailer);
                }
            }`,
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
