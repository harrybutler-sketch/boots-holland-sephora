import { PuppeteerCrawler } from 'crawlee';

async function testMorrisonsFullScrape() {
    const crawler = new PuppeteerCrawler({
        maxRequestsPerCrawl: 3,
        preNavigationHooks: [
            async ({ page }) => {
                await page.setViewport({ width: 1920, height: 1080 });
            }
        ],
        async requestHandler({ request, page, log }) {
            log.info(`Processing ${request.url}...`);
            
            // Accept cookies
            try {
                await page.waitForSelector('#onetrust-accept-btn-handler', { timeout: 3000 });
                await page.click('#onetrust-accept-btn-handler');
            } catch(e) {}
            
            // Replicate the smooth scroll loop
            log.info('Scrolling...');
            await page.evaluate(async () => {
                await new Promise((resolve) => {
                    let totalHeight = 0;
                    let distance = 200;
                    let timer = setInterval(() => {
                        let scrollHeight = document.body.scrollHeight;
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        if(totalHeight >= scrollHeight - window.innerHeight || totalHeight > 25000){
                            clearInterval(timer);
                            resolve();
                        }
                    }, 150);
                });
            });
            
            await new Promise(r => setTimeout(r, 12000));
            
            // Enqueue product links
            const productLinks = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('a[href*="/products/"]:not([href*="onetrust"])'))
                    .map(a => a.href)
                    .filter(href => href && (href.includes('/product') || href.includes('/p/')));
            });
            
            log.info(`Found ${productLinks.length} items`);
        }
    });

    await crawler.run(['https://groceries.morrisons.com/categories/fresh-chilled-foods/176739?boolean=new&sortBy=favorite
}

testMorrisonsFullScrape();
