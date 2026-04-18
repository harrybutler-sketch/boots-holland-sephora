import puppeteer from 'puppeteer';

async function testMorrisonsNext() {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    console.log('Navigating...');
    await page.goto('https://groceries.morrisons.com/categories/fresh-chilled-foods/176739?boolean=new&sortBy=favorite', { waitUntil: 'networkidle2' });
    
    console.log('Scrolling...');
    await page.evaluate(async () => {
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise(r => setTimeout(r, 4000));
    });
    
    const nextBtn = await page.evaluate(() => {
        const nextSelectors = ['a.next-page', 'a[aria-label*="Next"]', 'button[aria-label*="Next"]', 'a.pagination--button--next'];
        for (const sel of nextSelectors) {
            const el = document.querySelector(sel);
            if (el) return `Found: ${sel} -> ${el.href || el.tagName}`;
        }
        return 'No next button found!';
    });
    
    console.log(nextBtn);
    await browser.close();
}

testMorrisonsNext();
