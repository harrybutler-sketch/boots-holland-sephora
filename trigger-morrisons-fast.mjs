import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

const MORRISONS_FUNC = `async ({ page, request, log, pushData, enqueueLinks }) => {
    const url = request.url;
    log.info(\`Scraping Morrisons (Listing-Only): \${url}\`);

    await page.setViewport({ width: 1920, height: 1080 });
    
    // Cookie Acceptance
    try {
        const cookieId = '#onetrust-accept-btn-handler';
        await page.waitForSelector(cookieId, { timeout: 8000 });
        await page.click(cookieId);
        await new Promise(r => setTimeout(r, 1000));
    } catch (e) {}

    // Intensive scroll for hydration
    log.info('Scrolling for hydration...');
    for (let i = 0; i < 15; i++) {
        await page.evaluate(() => window.scrollBy(0, 800));
        await new Promise(r => setTimeout(r, 800));
        await page.mouse.move(Math.random() * 800, Math.random() * 600);
    }

    const products = await page.evaluate(() => {
        const tiles = Array.from(document.querySelectorAll('.product-card-container, .fop-item, .fops-item, li[class*="Product"]'));
        return tiles.map(tile => {
            const nameEl = tile.querySelector('.title-container a, .fop-description a, a[href*="/products/"]');
            if (!nameEl) return null;
            const name = nameEl.innerText.trim();
            const link = nameEl.href;
            
            const priceEl = tile.querySelector('.price-container, .fop-price, .price, [class*="price"]');
            const imgEl = tile.querySelector('.image-container img, .fop-img, img');

            return {
                product_name: name,
                product_url: link,
                price_display: priceEl?.innerText?.trim() || 'N/A',
                image_url: imgEl?.src || '',
                retailer: 'Morrisons',
                date_found: new Date().toISOString()
            };
        }).filter(Boolean);
    });

    log.info(\`Extracted \${products.length} products from Morrisons\`);

    for (const p of products) {
        const ln = p.product_name.toLowerCase();
        const isOwnBrand = ln.includes('morrisons') || ln.includes('the best') || ln.includes('savers') || ln.includes('market street');
        if (!isOwnBrand) {
            await pushData(p);
        }
    }

    await enqueueLinks({
        selector: 'a.next-page, a[aria-label*="Next"]',
        label: 'LISTING',
        userData: { retailer: 'Morrisons' }
    }).catch(() => {});
}`;

async function triggerMorrisonsFast() {
    const url = 'https://groceries.morrisons.com/categories/beer-wines-spirits/103120?boolean=new&sortBy=favorite';
    console.log(`Triggering REFINED FAST Morrisons scrape...`);

    try {
        const run = await client.actor('apify/puppeteer-scraper').start({
            startUrls: [{ url, userData: { retailer: 'Morrisons', label: 'LISTING' } }],
            useChrome: true,
            useStealth: true,
            proxyConfiguration: { useApifyProxy: true },
            pageFunction: MORRISONS_FUNC,
            requestHandlerTimeoutSecs: 300,
            pageFunctionTimeoutSecs: 300
        });

        console.log(`\nRun started: ${run.id}`);
        console.log(`View progress: https://console.apify.com/actors/apify/puppeteer-scraper/runs/${run.id}`);
    } catch (e) {
        console.error('Trigger Error:', e);
    }
}

triggerMorrisonsFast();
