import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function run() {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    const url = 'https://www.ocado.com/categories/food-cupboard/e67ba77e-b886-4d6d-a42e-7aa75cc0d52d?boolean=new&sortBy=favorite';
    console.log(`Navigating to ${url}`);
    
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    console.log('Scrolling down...');
    for(let i=0; i<10; i++){
        await page.evaluate(() => window.scrollBy(0, 1000));
        await new Promise(r => setTimeout(r, 1000));
    }
    
    const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a')).map(a => a.href).filter(href => href.includes('/products/') || href.includes('/product/'));
    });
    
    const uniqueLinks = [...new Set(links)];
    console.log(`Found ${uniqueLinks.length} product links on the page.`);
    console.log(uniqueLinks.slice(0, 5));
    
    await browser.close();
}

run().catch(console.error);
