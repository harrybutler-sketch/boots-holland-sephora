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

    // Configuration Maps
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

    const host = event.headers.host || 'boots-holland-sephora.vercel.app';
    const webhookUrl = `https://${host}/.netlify/functions/run-status?workspace=${workspace || 'beauty'}`;
    const runs = [];

    // 1. Trigger Ecommerce Scraper
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
        const run = await client.actor('apify/puppeteer-scraper').start({
          startUrls,
          useChrome: true,
          stealth: true,
          maxPagesPerCrawl: 400,
          proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'] },
          pageFunction: `async function pageFunction(context) { /* ... same as API ... */ }`
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
    return { statusCode: 500, body: JSON.stringify({ error: error.message || String(error) }) };
  }
};
