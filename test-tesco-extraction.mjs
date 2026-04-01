import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

const TEST_URL = 'https://www.tesco.com/groceries/en-GB/products/250106411'; // Yeo Valley Whole Milk 1L - Stable product

const runTescoTest = async () => {
    console.log('Testing Tesco Scraper 2.0 on:', TEST_URL);
    
    const run = await client.actor('apify/puppeteer-scraper').call({
        startUrls: [{ url: TEST_URL, userData: { label: 'DETAIL', retailer: 'Tesco' } }],
        pageFunction: async function pageFunction(context) {
            const { page, request, log } = context;
            const { retailer } = request.userData;

            log.info('Testing extraction for: ' + request.url);

            // 1. Force desktop viewport
            await page.setViewport({ width: 1920, height: 1080 });

            // 2. Clear cookie banner
            try {
                const cookieSelector = '#onetrust-accept-btn-handler';
                await page.waitForSelector(cookieSelector, { timeout: 5000 });
                await page.click(cookieSelector);
                await new Promise(r => setTimeout(r, 2000));
            } catch (e) {
                log.info('No cookie banner found or already accepted.');
            }

            // 3. WAIT FOR HYDRATION (Price-Gate)
            try {
                await page.waitForFunction(() => {
                    const title = document.querySelector('h1.product-details-tile__title');
                    const price = document.querySelector('.price-per-quantity-weight');
                    return title && title.innerText.trim().length > 0 && price && price.innerText.trim().length > 0;
                }, { timeout: 20000 });
            } catch (e) {
                log.warning('Timed out waiting for hydration/price-gate.');
            }

            const extractionData = await page.evaluate((retailer) => {
                const tescoTitle = document.querySelector('h1.product-details-tile__title');
                const h1 = tescoTitle || document.querySelector('h1');
                let name = h1 ? h1.innerText.trim() : document.title;

                name = name.replace(/ - Tesco Groceries$/i, '').trim();

                const results = { 
                    url: window.location.href, 
                    retailer: retailer, 
                    name: name,
                    isMarketplace: !!document.querySelector('a.marketplace-seller-link')
                };

                const priceEl = document.querySelector('.price-per-quantity-weight');
                results.priceFound = !!priceEl;
                if (priceEl) results.priceText = priceEl.innerText.trim();

                const img = document.querySelector('.product-details-tile__image-container img');
                if (img) results.image = img.src;

                return results;
            }, retailer);

            log.info('Extraction result: ' + JSON.stringify(extractionData));
            return extractionData;
        },
        proxyConfiguration: { useApifyProxy: true, groups: ['RESIDENTIAL'] },
        launchContext: { useChrome: true },
    });

    console.log('Run completed! ID:', run.id);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    console.log('Extracted Data:', JSON.stringify(items, null, 2));
};

runTescoTest();
