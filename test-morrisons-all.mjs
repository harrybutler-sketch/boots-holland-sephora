import puppeteer from 'puppeteer';

async function testMorrisonsAllNew() {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    console.log('Navigating...');
    await page.goto('https://groceries.morrisons.com/categories/fresh-chilled-foods/176739?boolean=new&sortBy=favorite', { waitUntil: 'networkidle2' });
    
    console.log('Scrolling a bit...');
    await page.evaluate(async () => {
        window.scrollBy(0, 1000);
        await new Promise(r => setTimeout(r, 2000));
        window.scrollBy(0, 1000);
    });
    
    console.log('Waiting for products...');
    await new Promise(r => setTimeout(r, 8000));
    
    const html = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/products/"]:not([href*="onetrust"])'));
        return links.map(l => l.href);
    });
    
    console.log(`Found ${html.length} raw product links:`);
    console.log(html.slice(0, 10).join('\n'));
    await browser.close();
}

testMorrisonsAllNew();
