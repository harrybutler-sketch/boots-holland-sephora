import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setExtraHTTPHeaders({
        'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'referer': 'https://www.google.com/'
    });

    console.log('Navigating...');
    await page.goto('https://www.sainsburys.co.uk/gol-ui/features/new-in-chilled', { waitUntil: 'networkidle2' });
    
    // Scroll
    for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollBy(0, 1000));
        await new Promise(r => setTimeout(r, 1000));
    }
    
    const elements = await page.evaluate(() => {
        return {
            pt_link: document.querySelectorAll('.pt__link').length,
            product_tile: document.querySelectorAll('[data-testid="product-tile"]').length,
            article: document.querySelectorAll('article').length,
            links: Array.from(document.querySelectorAll('a')).map(a => a.href).filter(h => h.includes('/product/')).length,
            classes: Array.from(new Set(Array.from(document.querySelectorAll('article, li')).map(el => el.className)))
        };
    });
    
    console.log(elements);
    await browser.close();
})();
