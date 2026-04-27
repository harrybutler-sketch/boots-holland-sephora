import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';

dotenv.config();

const execPromise = promisify(exec);
const APIFY_TOKEN = process.env.APIFY_TOKEN;

if (!APIFY_TOKEN) {
    console.error('Missing APIFY_TOKEN!');
    process.exit(1);
}

const client = new ApifyClient({ token: APIFY_TOKEN });

// Get target URL from command line or default to original
const args = process.argv.slice(2);
const targetUrl = args[0] || 'https://www.asda.com/groceries/event/new-beer-wine-spirits';

async function triggerScrape() {
    console.log(`Triggering one-off Asda scrape for: ${targetUrl}`);

    try {
        const run = await client.actor('apify/puppeteer-scraper').start({
            startUrls: [{ url: targetUrl, userData: { retailer: 'Asda', label: 'LISTING' } }],
            useChrome: true,
            useStealth: true,
            proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'], countryCode: 'GB' },
            requestHandlerTimeoutSecs: 600,
            pageFunctionTimeoutSecs: 600,
            handlePageTimeoutSecs: 600,
            navigationTimeoutSecs: 120,
            pageFunction: `async ({ page, request, log, enqueueLinks, response }) => {
                const { url, userData: { retailer, label } } = request;
                
                await page.setViewport({ width: 1920, height: 1080 });
                await page.setExtraHTTPHeaders({
                    'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"',
                    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
                    'referer': 'https://www.google.com/'
                });

                log.info('Warming Asda session...');
                await page.goto('https://www.asda.com/', { waitUntil: 'networkidle2', timeout: 45000 }).catch(() => log.warning('Asda warm-up timed out.'));
                await new Promise(r => setTimeout(r, 3000));
                
                log.info('Navigating to target: ' + url);
                const navResponse = await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 }).catch(e => {
                    log.error('Asda navigation failed: ' + e.message);
                    return null;
                });
                
                // Cookie Acceptance
                try {
                    const cookieId = '#onetrust-accept-btn-handler';
                    await page.waitForSelector(cookieId, { timeout: 10000 });
                    await page.click(cookieId);
                    await new Promise(r => setTimeout(r, 2000));
                } catch (e) {
                    log.info('Asda cookie banner not found or handled.');
                }

                // Wait for products
                log.info('Waiting for Asda products...');
                const asdaSelector = '[data-testid="product-tile"], .co-item, .asda-product-tile';
                await page.waitForSelector(asdaSelector, { timeout: 45000 }).catch(() => log.warning('No Asda products rendered after 45s.'));

                // Scroll for hydration
                log.info('Scrolling for hydration...');
                for (let i = 0; i < 15; i++) {
                    await page.evaluate(() => window.scrollBy(0, 1000));
                    await new Promise(r => setTimeout(r, 800));
                }

                // Extraction
                const products = await page.evaluate(() => {
                    const tiles = Array.from(document.querySelectorAll('[data-testid="product-tile"], .co-item, .asda-product-tile, article[class*="product"]'));
                    return tiles.map(tile => {
                        const nameEl = tile.querySelector('h3 a, .co-product__title a, a[href*="/product/"], [class*="title"] a');
                        if (!nameEl) return null;
                        const name = nameEl.innerText.trim();
                        if (!name || name.length < 3) return null;

                        const priceEl = tile.querySelector('.co-product__price, [data-testid="price"], .product-price, .co-item__price');
                        const imgEl = tile.querySelector('img');

                        return {
                            product_name: name,
                            retailer: 'Asda',
                            price_display: priceEl?.innerText?.trim() || 'N/A',
                            product_url: nameEl.href || window.location.href,
                            image_url: imgEl?.src || '',
                            date_found: new Date().toISOString()
                        };
                    }).filter(Boolean);
                });

                log.info(\`Extracted \${products.length} Asda products.\`);

                const filtered = products.filter(p => {
                    const ln = p.product_name.toLowerCase();
                    const isOwnBrand = ln.includes('asda') || ln.includes('extra special') || ln.includes('just essentials') || ln.includes('smart price');
                    return !isOwnBrand;
                });

                log.info(\`Filtered to \${filtered.length} non-own-brand Asda products.\`);

                await enqueueLinks({ 
                    selector: 'a[aria-label="Next page"], button[aria-label="Next page"], .co-pagination__next', 
                    label: 'LISTING', 
                    userData: { retailer: 'Asda' } 
                }).catch(() => {});

                return filtered;
            }`
        });

        console.log(`\nRun started: ${run.id}`);
        console.log(`View progress: https://console.apify.com/actors/apify/puppeteer-scraper/runs/${run.id}`);
        
        console.log('Waiting for run to finish...');
        let finishedRun = await client.run(run.id).waitForFinish();
        
        if (finishedRun.status === 'SUCCEEDED') {
            console.log('\nScrape SUCCEEDED! Triggering sync to sheet...');
            // We use the same script name as in the original file
            const { stdout, stderr } = await execPromise(`node sync-run-to-sheet.mjs ${run.id} --force`);
            console.log(stdout);
            if (stderr) console.error(stderr);
        } else {
            console.error(`Scrape finished with status: ${finishedRun.status}`);
        }
        
    } catch (error) {
        console.error('Trigger failed:', error);
    }
}

triggerScrape();
