import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import dotenv from 'dotenv';
dotenv.config();

puppeteer.use(StealthPlugin());

async function testSainsburys() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    const url = 'https://www.sainsburys.co.uk/gol-ui/features/newforsnacks';
    console.log(`Navigating to: ${url}`);

    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        const title = await page.title();
        console.log(`Page title: ${title}`);

        if (title.toLowerCase().includes('access denied')) {
            console.error('STILL BLOCKED with Stealth!');
            return;
        }

        // Simplified logic from run-scrape.js
        const retailer = 'Sainsburys';
        const selector = '.pt__link, a[href*="/gol-ui/product/"], a[href*="/product/"]';

        console.log('Scrolling...');
        const scrolls = 10;
        for (let i = 0; i < scrolls; i++) {
            await page.evaluate(() => window.scrollBy(0, 800));
            await new Promise(r => setTimeout(r, 1000));
        }

        console.log('Waiting for selector...');
        try {
            await page.waitForSelector(selector, { timeout: 30000 });
            console.log('Selector found!');
        } catch (e) {
            console.warn('Selector NOT found within timeout.');
            const html = await page.content();
            console.log('HTML Snippet:', html.substring(0, 500));
        }

        const links = await page.evaluate((sel) => {
            return Array.from(document.querySelectorAll(sel)).map(a => a.href);
        }, selector);

        console.log(`Found ${links.length} product links.`);

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await browser.close();
    }
}

testSainsburys();
