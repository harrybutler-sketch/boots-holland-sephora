import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function run() {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Tesco -> New In -> All items
    const url = 'https://www.tesco.com/groceries/en-GB/shop/drinks/all?sortBy=relevance&facetsArgs=new%3Atrue&count=24';
    console.log(`Navigating to ${url}`);
    
    await page.goto(url, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 4000));
    
    // Check what is actually on the page
    const pageData = await page.evaluate(() => {
        const h1 = document.querySelector('h1') ? document.querySelector('h1').innerText : 'No H1';
        const title = document.title;
        const products = document.querySelectorAll('a[href*="/products/"]');
        const lists = document.querySelectorAll('ul, ol, .product-list');
        const isAccessDenied = document.body.innerText.toLowerCase().includes('access denied');
        
        return {
            h1,
            title,
            numProductLinks: products.length,
            numLists: lists.length,
            isAccessDenied,
            bodySnippet: document.body.innerText.substring(0, 500)
        };
    });
    
    console.log(pageData);
    await browser.close();
}

run().catch(console.error);
