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
    
    const products = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('.fops-item, .fop-item, li[class*="fop"]'));
        return items.map(item => {
            const link = item.querySelector('a') ? item.querySelector('a').href : null;
            const title = item.querySelector('.fop-title') ? item.querySelector('.fop-title').innerText : 'Unknown title';
            
            // Look for rating/reviews
            let reviews = 0;
            const reviewElement = item.querySelector('.fop-rating__count, .rating-count');
            if (reviewElement) {
                reviews = parseInt(reviewElement.innerText.replace(/[^0-9]/g, '')) || 0;
            } else {
                // Check if there are stars or "read x reviews"
                const textInfo = item.innerText;
                const match = textInfo.match(/(\d+)\s*reviews/i) || textInfo.match(/\((\d+)\)/);
                if (match) reviews = parseInt(match[1]);
            }
            
            return { title, link, reviews };
        }).filter(p => p.link && p.link.includes('/products/'));
    });

    console.log(`Extracted ${products.length} products visually.`);
    
    const valid = [];
    for (const p of products) {
        const isOwnBrand = ['m&s', 'ocado'].some(kw => p.title.toLowerCase().includes(kw.toLowerCase()));
        if (!isOwnBrand && p.reviews <= 5) {
            valid.push(p);
        } else {
            console.log(`[FILTERED] ${p.title} (Reviews: ${p.reviews}, OwnBrand: ${isOwnBrand})`);
        }
    }
    
    console.log(`\nRemaining Valid Products (${valid.length}):`);
    console.dir(valid);
    
    await browser.close();
}

run().catch(console.error);
