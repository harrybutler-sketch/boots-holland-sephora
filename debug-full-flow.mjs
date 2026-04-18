import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function simulateScraper(startUrl, listingSelector, retailer) {
    console.log(`\n--- Simulating Full Scrape for ${retailer} ---`);
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    try {
        console.log(`Navigating to listing: ${startUrl}`);
        await page.goto(startUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 5000));

        const detailUrls = await page.evaluate((sel) => {
            return Array.from(document.querySelectorAll(sel)).map(a => a.href).slice(0, 2);
        }, listingSelector);

        console.log(`Found ${detailUrls.length} sample detail URLs:`, detailUrls);

        for (const url of detailUrls) {
            console.log(`Navigating to detail: ${url}`);
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            await new Promise(r => setTimeout(r, 3000));

            const results = await page.evaluate((ret) => {
                const res = {
                    product_name: document.querySelector('h1')?.innerText?.trim() || 'N/A',
                    retailer: ret,
                    price_display: 'N/A',
                    reviews: 0,
                    rating: '0.0',
                    image_url: '',
                    product_url: window.location.href
                };

                const priceSelectors = ['.pd__cost', '.product-details-tile__price', '.product-price', '.price', '.ddsweb-price--primary'];
                for (const sel of priceSelectors) {
                    const el = document.querySelector(sel);
                    if (el && el.innerText) { res.price_display = el.innerText.trim(); break; }
                }
                
                const reviewSelectors = ['.review-summary__count', '.star-rating-link span', 'a[href="#reviews-title"] span', '[class*="starRating"] span', '.bv_numReviews_text'];
                for (const sel of reviewSelectors) {
                    const el = document.querySelector(sel);
                    if (el) {
                        const match = el.innerText.match(/\d+/);
                        if (match) { res.reviews = parseInt(match[0]) || 0; break; }
                    }
                }
                
                return res;
            }, retailer);

            console.log('Extracted Details:', JSON.stringify(results, null, 2));
            
            // Check Own Brand filter
            const ownBrandKeywords = ["Asda", "Extra Special", "Sainsbury", "Taste the Difference", "Waitrose", "Essential Waitrose", "Tesco", "Finest", "Morrisons", "The Best", "Boots", "H&B", "Holland & Barrett"];
            const isOwnBrand = ownBrandKeywords.some(kw => results.product_name.toLowerCase().includes(kw.toLowerCase()));
            console.log(`Is Own Brand? ${isOwnBrand}`);
            console.log(`Reviews > 5? ${results.reviews > 5}`);
        }
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await browser.close();
    }
}

async function run() {
    await simulateScraper(
        'https://www.hollandandbarrett.com/shop/highlights/new-in/?category=8939&page=2#products-list',
        'a[href*="/shop/product/"]',
        'Holland & Barrett'
    );
    
    await simulateScraper(
        'https://www.sephora.co.uk/new-at-sephora?filter=fh_location=//c1/en_GB/in_stock%3E{in}/new_in=1/!exclude_countries%3E{gb}/!site_exclude%3E{79}/!brand=a70/%26fh_view_size=40%26date_time=20260413T104639%26site_area=cms%26device=desktop%26fh_sort_by=-%24rc_new_in#inline-facets',
        'a[href*="/p/"]',
        'Sephora'
    );
}

run();
