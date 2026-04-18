import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function run() {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Food Cupboard -> New In -> All items
    const url = 'https://www.ocado.com/categories/food-cupboard/e67ba77e-b886-4d6d-a42e-7aa75cc0d52d?boolean=new&sortBy=favorite';
    console.log(`Navigating to ${url}`);
    
    await page.goto(url, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 4000));
    
    const countInfo = await page.evaluate(() => {
        const textNodes = Array.from(document.querySelectorAll('body *')).filter(el => {
            return (el.innerText || '').match(/showing.*of/i) || (el.innerText || '').match(/products/i);
        });
        
        const count = document.querySelector('h1, h2, .product-count, [data-test-id="product-count"]');
        return {
            title: document.title,
            countText: count ? count.innerText : 'not found',
            allText: document.body.innerText.substring(0, 1000)
        };
    });
    
    console.log(countInfo);
    await browser.close();
}

run().catch(console.error);
