import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

const TEST_URL = 'https://www.tesco.com/groceries/en-GB/products/250106411'; // Yeo Valley Whole Milk 1L - Stable product

const runTescoTest = async () => {
    console.log('Testing Tesco Scraper 2.3 on:', TEST_URL);
    
    const run = await client.actor('apify/puppeteer-scraper').call({
        startUrls: [{ url: TEST_URL, userData: { label: 'DETAIL', retailer: 'Tesco' } }],
        maxConcurrency: 1,
        pageFunction: async function pageFunction(context) {
            const { page, request, log } = context;
            const retailer = 'Tesco';

            log.info('Testing extraction for: ' + request.url);

            // 1. Force desktop viewport
            await page.setViewport({ width: 1920, height: 1080 });

            // 2. Immediate Block/Oops check
            const blockStatus = await page.evaluate(() => {
                const h1Text = document.querySelector('h1')?.innerText?.toLowerCase() || '';
                const bodyText = document.body.innerText.toLowerCase();
                if (h1Text.includes('oops') || h1Text.includes("it's not you, it's us") || h1Text.includes('something went wrong')) return 'BLOCK';
                if (bodyText.includes('access denied')) return 'BLOCK';
                if (bodyText.includes('not down this aisle')) return 'SKIP'; // 404
                return 'OK';
            });
            
            if (blockStatus === 'BLOCK') {
                throw new Error('Tesco Blocked ("Oops" page detected). Retrying with fresh proxy...');
            }

            // 3. IMMEDIATE Own Brand check
            const isOwnBrand = await page.evaluate(() => {
                const name = (document.querySelector('h1')?.innerText || document.title).toLowerCase();
                return name.includes('tesco');
            });

            if (isOwnBrand) {
                log.info('Skipping Own Brand early (Tesco): ' + request.url);
                return { skipped: true, reason: 'Own Brand' };
            }

            // 4. Resilient Hydration
            try {
                await page.waitForSelector('h1', { timeout: 25000 });
            } catch (e) {
                log.warning('Timed out waiting for H1 at ' + request.url);
            }

            const extractionData = await page.evaluate((retailer) => {
                const mainContent = document.querySelector('main, #main, .product-details-page, [role="main"]');
                const tescoTitle = document.querySelector('h1.product-details-tile__title, h1.product-details-page__title, [data-testid="product-title"]');
                const h1 = tescoTitle || (mainContent ? mainContent.querySelector('h1') : document.querySelector('h1'));
                let name = h1 ? h1.innerText.trim() : document.title;

                name = name.replace(/ - Tesco Groceries$/i, '').trim();

                const results = { 
                    url: window.location.href, 
                    retailer: retailer, 
                    name: name,
                    isMarketplace: !!document.querySelector('a.marketplace-seller-link')
                };

                const priceEl = document.querySelector('.price-per-basket-unit, .price-details--unit-price, .value, [data-testid="product-price"], .price-per-quantity-weight');
                results.priceFound = !!priceEl;
                if (priceEl) results.priceText = priceEl.innerText.trim();

                const img = document.querySelector('.product-details-tile__image-container img, .product-image img');
                if (img) results.image = img.src;

                return results;
            }, retailer);

            log.info('Extraction result: ' + JSON.stringify(extractionData));
            return extractionData;
        },
        proxyConfiguration: { useApifyProxy: true, groups: ['RESIDENTIAL'], countryCode: 'GB' },
        launchContext: { useChrome: true },
        useStealth: true,
        fingerprinting: true,
    });

    console.log('Run completed! ID:', run.id);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    console.log('Extracted Data:', JSON.stringify(items, null, 2));
};

runTescoTest();
