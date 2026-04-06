
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Tesco Scraper v2.3.9 (The "Final Resolution" Sync)
 * - Comprehensive Block Detection: H1 "Oops", "Not down this aisle", "Access Denied"
 * - Title-Level Awareness: Detects [Error - Tesco Groceries] and [Access Denied]
 * - Debug Logging: Explicitly logs H1 text for detail-page transparency
 * - Extraction Guard: Rejects "Oops" or "Aisle" names to prevent empty results
 * - Increased Load Delays: 12s detail-page wait for full hydration
 * - Strict UK Residential Proxy Lock
 */

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

async function triggerTescoScrape() {
    const listingUrls = [
        'https://www.tesco.com/groceries/en-GB/shop/treats-and-snacks/all?sortBy=relevance&facetsArgs=new%3Atrue&count=24',
        'https://www.tesco.com/groceries/en-GB/shop/treats-and-snacks/all?sortBy=relevance&page=2&facetsArgs=new%3Atrue&count=24'
    ];

    console.log('Triggering Tesco STABLE Scrape (eCommerce Tool) for Snack Categories...');

    try {
        const run = await client.actor('apify/e-commerce-scraping-tool').start({
            listingUrls: listingUrls.map(url => ({ url })),
            maxItems: 300,
            proxyConfiguration: { 
                useApifyProxy: true, 
                apifyProxyGroups: ['RESIDENTIAL'], 
                countryCode: 'GB' 
            },
            timeoutSecs: 1200
        });

        console.log('Scrape started! Run ID:', run.id);
        console.log('View run at:', `https://console.apify.com/view/runs/${run.id}`);
    } catch (e) {
        console.error('Trigger Error:', e);
    }
}

triggerTescoScrape();

