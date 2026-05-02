import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`file://${process.cwd()}/sainsburys_listing.html`);
    
    const products = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('.pt__link'));
        return links.map(linkEl => {
            const tile = linkEl.closest('article, [data-testid="product-tile"], li');
            const name = linkEl.innerText.trim();
            const link = linkEl.href;
            return {
                name,
                hasTile: !!tile,
                nameLength: name ? name.length : 0,
                html: linkEl.outerHTML
            };
        }).slice(0, 3);
    });
    
    console.dir(products, { depth: null });
    await browser.close();
})();
