import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function run() {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    const url = 'https://www.ocado.com/categories/food-cupboard/e67ba77e-b886-4d6d-a42e-7aa75cc0d52d?boolean=new&sortBy=favorite';
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    for(let i=0; i<5; i++){
        await page.evaluate(() => window.scrollBy(0, 1000));
        await new Promise(r => setTimeout(r, 1000));
    }
    
    // Extract HTML of the main container to analyze classes
    const htmlSnippet = await page.evaluate(() => {
        const productLinks = Array.from(document.querySelectorAll('a[href*="/products/"]'));
        if (productLinks.length === 0) return 'No product links found';
        
        let container = productLinks[0];
        while (container && container.tagName !== 'LI' && container.tagName !== 'DIV') {
            container = container.parentElement;
        }
        
        if (container.parentElement && container.parentElement.parentElement) {
            return container.parentElement.innerHTML.substring(0, 3000);
        }
        return container.outerHTML.substring(0, 3000);
    });
    
    console.log(htmlSnippet);
    await browser.close();
}

run().catch(console.error);
