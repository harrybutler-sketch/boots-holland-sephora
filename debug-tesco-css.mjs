import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function run() {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Tesco -> New In -> All items
    const url = 'https://www.tesco.com/groceries/en-GB/shop/drinks/all?viewAll=new&new=new';
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    const extraction = await page.evaluate(() => {
        // Try to identify the main list items
        const listItems = document.querySelectorAll('li[class*="list-item"], div[class*="ProductTile"], .product-list--list-item, li');
        
        // Let's just find the first few product text links to see what classes they have
        const linksContext = Array.from(document.querySelectorAll('a[href*="/products/"]')).slice(0, 5).map(a => {
            const innerTextLength = a.innerText.trim().length;
            const hasImg = a.querySelector('img') !== null;
            return {
                href: a.href,
                className: a.className,
                innerTextLen: innerTextLength,
                isImgLink: hasImg,
                text: a.innerText.trim().substring(0, 50)
            };
        });

        return {
            totalLi: listItems.length,
            linksContext
        };
    });
    
    console.log(JSON.stringify(extraction, null, 2));
    await browser.close();
}

run().catch(console.error);
