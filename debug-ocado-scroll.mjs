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
    
    let previousLinks = 0;
    
    for(let i=0; i<30; i++){
        await page.evaluate(() => window.scrollBy(0, 1000));
        await new Promise(r => setTimeout(r, 1000));
        
        const links = await page.evaluate(() => {
            return [...new Set(Array.from(document.querySelectorAll('a[href*="/products/"]')).map(a => a.href))].length;
        });
        
        if (links > previousLinks) {
            console.log(`Scroll ${i}: Found ${links} links`);
            previousLinks = links;
        }
    }
    
    // Check for "Show more" or "Load more"
    const loadMore = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const l = btns.find(b => b.innerText.toLowerCase().includes('more') || b.innerText.toLowerCase().includes('load') || b.innerText.toLowerCase().includes('show'));
        return l ? l.innerText : 'None';
    });
    console.log(`Load More Button Text: ${loadMore}`);

    await browser.close();
}

run().catch(console.error);
