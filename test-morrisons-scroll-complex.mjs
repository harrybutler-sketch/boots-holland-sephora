import puppeteer from 'puppeteer';

async function testMorrisonsComplexScroll() {
    const browser = await puppeteer.launch({ headless: false }); // Open visible browser to debug
    const page = await browser.newPage();
    
    // Set viewport big to load more items per row
    await page.setViewport({ width: 1920, height: 1080 });
    
    console.log('Navigating...');
    await page.goto('https://groceries.morrisons.com/categories/fresh-chilled-foods/176739?boolean=new&sortBy=favorite', { waitUntil: 'networkidle2' });
    
    console.log('Accepting cookies...');
    try {
        await page.waitForSelector('#onetrust-accept-btn-handler', { timeout: 3000 });
        await page.click('#onetrust-accept-btn-handler');
    } catch(e) {}
    
    console.log('Scrolling down continuously...');
    
    // Instead of jumping by 800px, slowly scroll down the entire page height to ensure every lazy intersection observer fires
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            let distance = 100;
            let timer = setInterval(() => {
                let scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                // Stop after scrolling down roughly 20 full screens, or hitting bottom
                if(totalHeight >= scrollHeight - window.innerHeight || totalHeight > 20000){
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
    
    await new Promise(r => setTimeout(r, 5000));
    
    const html = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/products/"]:not([href*="onetrust"])'));
        return links.map(l => l.innerText.split('\n')[0]);
    });
    
    console.log(`Finished scrolling. Total product links visible in DOM: ${html.length}`);
    if (html.length > 0) {
        console.log('Sample links:', html.slice(-10));
    }
    
    await browser.close();
}

testMorrisonsComplexScroll();
