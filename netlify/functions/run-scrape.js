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

    // Configure input for the Apify Actor
    // This assumes a generic scraper or one that accepts startUrls
    // The prompt specified "New In" pages for Sephora, Boots, H&B
    const startUrls = [];

    if (workspace === 'beauty') {
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
    } else if (workspace === 'grocery') {
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
          startUrls.push({
            url: groceryMap[retailer],
            userData: { retailer }
          });
        }
      });
    }

    // Call the actor
    // Using .start() instead of .call() to return immediately and avoid Netlify 10s timeout
    const run = await client.actor(process.env.APIFY_ACTOR_ID).start({
      // e-commerce-scraping-tool requires specific url arrays
      // "New In" pages are listings/categories, so we use listingUrls
      listingUrls: startUrls,
      scrapeMode: 'BROWSER',
      // Dynamic limit: 150 per retailer (e.g., 3 retailers = 450 items)
      maxProductResults: retailers.length * 150,
      proxyConfiguration: {
        useApifyProxy: true
      },
      includeReviews: true,
      maxReviews: 20,
      countryCode: 'US'
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        runId: run.id,
        statusUrl: run.statusUrl, // Or construct our own status endpoint URL
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
