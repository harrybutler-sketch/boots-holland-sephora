import { ApifyClient } from 'apify-client';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).send('Method Not Allowed');
  }

  try {
    // Robust body parsing for Vercel
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
      return response.status(500).json({ error: 'APIFY_TOKEN is not configured on the server.' });
    }

    const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

    // Configuration Maps - Same as before but verified
    const groceryMap = {
      'Sainsburys': 'https://www.sainsburys.co.uk/gol-ui/features/new-in\nhttps://www.sainsburys.co.uk/shop/gb/groceries/get-ideas/new-products/all-new-products',
      'Tesco': 'https://www.tesco.com/groceries/en-GB/search?query=new%20in&icid=gh_hp_search_new%20in',
      'Asda': 'https://groceries.asda.com/search/new%20in\nhttps://groceries.asda.com/shelf/new-in/1215685911554',
      'Morrisons': 'https://groceries.morrisons.com/categories/new/192077\nhttps://groceries.morrisons.com/search?entry=new+in',
      'Ocado': 'https://www.ocado.com/search?entry=new%20in\nhttps://www.ocado.com/browse/new-in-119934',
      'Waitrose': 'https://www.waitrose.com/ecom/shop/browse/groceries/new\nhttps://www.waitrose.com/ecom/shop/search?&searchTerm=new%20in'
    };

    const standardNameMap = {
      'sainsburys': 'Sainsburys', 'sainsbury': 'Sainsburys', 'sainsbury\'s': 'Sainsburys',
      'tesco': 'Tesco', 'asda': 'Asda', 'superdrug': 'Superdrug',
      'morrisons': 'Morrisons', 'ocado': 'Ocado', 'waitrose': 'Waitrose'
    };

    const ecommerceScraperKeys = Object.keys(standardNameMap);
    const ecommerceRetailersToScrape = [];
    const puppeteerRetailersToScrape = [];

    retailers.forEach(r => {
      const cleanName = r.trim().toLowerCase();
      if (ecommerceScraperKeys.includes(cleanName)) {
        ecommerceRetailersToScrape.push(r);
      } else {
        puppeteerRetailersToScrape.push(r);
      }
    });

    const host = request.headers.host || 'boots-holland-sephora.vercel.app';
    const webhookUrl = `https://${host}/api/run-status?workspace=${workspace || 'beauty'}`;
    const runs = [];

    // 1. Trigger E-commerce Scraping Tool
    if (ecommerceRetailersToScrape.length > 0) {
      const queries = [];
      ecommerceRetailersToScrape.forEach(r => {
        const stdName = standardNameMap[r.trim().toLowerCase()];
        if (stdName === 'Superdrug') {
          queries.push('https://www.superdrug.com/new-in/c/new');
        } else if (groceryMap[stdName]) {
          queries.push(groceryMap[stdName]);
        }
      });

      if (queries.length > 0) {
        console.log('Starting Ecommerce Scraper...');
        const run = await client.actor('apify/e-commerce-scraping-tool').start({
          queries: queries.join('\n'),
          maxItems: 1000,
          proxyConfiguration: { useApifyProxy: true }
        }, {
          webhooks: [{ eventTypes: ['ACTOR.RUN.SUCCEEDED'], requestUrl: webhookUrl + '&source=ecommerce' }]
        });
        runs.push({ id: run.id, actor: 'e-commerce-scraping-tool', retailers: ecommerceRetailersToScrape });
      }
    }

    // 2. Trigger Puppeteer Scraper
    if (puppeteerRetailersToScrape.length > 0) {
      const startUrls = [];
      if (puppeteerRetailersToScrape.some(r => r.toLowerCase().includes('sephora'))) {
        startUrls.push({ url: 'https://www.sephora.co.uk/new-at-sephora', userData: { retailer: 'Sephora', label: 'LISTING' } });
      }
      if (puppeteerRetailersToScrape.some(r => r.toLowerCase().includes('boots'))) {
        startUrls.push({ url: 'https://www.boots.com/new-to-boots', userData: { retailer: 'Boots', label: 'LISTING' } });
      }
      if (puppeteerRetailersToScrape.some(r => r.toLowerCase().includes('holland'))) {
        startUrls.push({ url: 'https://www.hollandandbarrett.com/shop/health-wellness/?t=is_new%3Atrue', userData: { retailer: 'Holland & Barrett', label: 'LISTING' } });
        startUrls.push({ url: 'https://www.hollandandbarrett.com/shop/natural-beauty/natural-beauty-shop-all/?t=is_new%3Atrue', userData: { retailer: 'Holland & Barrett', label: 'LISTING' } });
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
      return response.status(400).json({ error: 'No scrapers triggered. Check names.', debug: { retailers, ecommerceRetailersToScrape } });
    }

    return response.status(200).json({
      message: `Triggered ${runs.length} runs`,
      runId: runs[0].id,
      runs,
      debug: { ecommerceRetailersToScrape, puppeteerRetailersToScrape }
    });
  } catch (error) {
    console.error('Fatal Error:', error);
    return response.status(500).json({ error: error.message || String(error) || 'Internal Server Error' });
  }
}
