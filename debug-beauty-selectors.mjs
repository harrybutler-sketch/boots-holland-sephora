import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function debugUrl(url, selector, retailer) {
    console.log(`\n--- Testing ${retailer} ---`);
    console.log(`URL: ${url}`);
    console.log(`Selector: ${selector}`);
    
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 5000));
        
        const data = await page.evaluate((sel) => {
            const links = Array.from(document.querySelectorAll(sel));
            return {
                title: document.title,
                linksFound: links.length,
                sampleLinks: links.slice(0, 3).map(a => a.href),
                h1: document.querySelector('h1')?.innerText
            };
        }, selector);
        
        console.log('Results:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await browser.close();
    }
}

async function run() {
    await debugUrl(
        'https://www.hollandandbarrett.com/shop/highlights/new-in/?category=8939&page=2#products-list',
        'a[href*="/shop/product/"]',
        'Holland & Barrett'
    );
    
    await debugUrl(
        'https://www.sephora.co.uk/new-at-sephora?filter=fh_location=//c1/en_GB/in_stock%3E{in}/new_in=1/!exclude_countries%3E{gb}/!site_exclude%3E{79}/!brand=a70/%26fh_view_size=40%26date_time=20260413T104639%26site_area=cms%26device=desktop%26fh_sort_by=-%24rc_new_in#inline-facets',
        'a[href*="/p/"]',
        'Sephora'
    );
}

run();
