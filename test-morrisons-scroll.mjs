import puppeteer from 'puppeteer';

async function testMorrisonsScroll() {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    console.log('Navigating...');
    await page.goto('https://groceries.morrisons.com/categories/fresh-chilled-foods/176739?boolean=new&sortBy=favorite', { waitUntil: 'networkidle2' });
    
    console.log('Scrolling down...');
    await page.evaluate(async () => {
        for (let i = 0; i < 25; i++) {
            window.scrollBy(0, 800);
            await new Promise(r => setTimeout(r, 1500));
        }
    });
    
    const html = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/products/"]:not([href*="onetrust"])'));
        return links.length;
    });
    
    console.log(`Finished scrolling. Total product links visible in DOM: ${html}`);
    
    // Check if there is a "Load More" button instead of infinite scroll
    const loadMoreBtn = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const loadBtn = btns.find(b => b.innerText.toLowerCase().includes('load') || b.innerText.toLowerCase().includes('more'));
        return loadBtn ? 'Found a Load More button instead of infinite scroll!' : 'No load more button found.';
    });
    console.log(loadMoreBtn);

    await browser.close();
}

testMorrisonsScroll();
