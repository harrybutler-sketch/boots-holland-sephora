import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`file://${process.cwd()}/sainsburys_listing.html`);
    
    const products = await page.evaluate(() => {
        // Try looking for product titles or links
        const items = Array.from(document.querySelectorAll('li')).slice(0, 5).map(li => {
            const h2 = li.querySelector('h2');
            const h3 = li.querySelector('h3');
            const link = li.querySelector('a');
            return {
                h2: h2 ? h2.innerText : null,
                h3: h3 ? h3.innerText : null,
                link: link ? link.href : null,
                classes: li.className
            };
        });
        
        const ptLinks = document.querySelectorAll('.pt__link').length;
        return { items, ptLinks };
    });
    
    console.dir(products, { depth: null });
    await browser.close();
})();
