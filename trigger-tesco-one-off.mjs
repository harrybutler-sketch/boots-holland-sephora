import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

async function triggerTescoScrape() {
    // Both Snacks and Food Cupboard categories for maximum coverage
    const listingUrls = [
        { url: 'https://www.tesco.com/groceries/en-GB/shop/treats-and-snacks/all?sortBy=relevance&facetsArgs=new%3Atrue' },
        { url: 'https://www.tesco.com/groceries/en-GB/shop/food-cupboard/all?sortBy=relevance&facetsArgs=new%3Atrue' }
    ];

    console.log('Triggering Tesco eCommerce Scraper (Main Shop)...');

    try {
        const run = await client.actor('apify/e-commerce-scraping-tool').start({
            listingUrls,
            maxItems: 300,
            proxyConfiguration: { 
                useApifyProxy: true, 
                apifyProxyGroups: ['RESIDENTIAL'], 
                countryCode: 'GB' 
            },
            timeoutSecs: 1800
        });

        console.log('Scrape started! Run ID:', run.id);
        console.log('View run at:', `https://console.apify.com/view/runs/${run.id}`);
    } catch (e) {
        console.error('Trigger Error:', e);
    }
}

triggerTescoScrape();
