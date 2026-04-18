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
    await new Promise(r => setTimeout(r, 4000));
    
    // Look for anything resembling a Next button or pagination.
    const paginationInfo = await page.evaluate(() => {
        const result = { html: '', selectors: [] };
        // Check for any anchor with 'next' in class, aria-label, or text
        const nextAnchors = Array.from(document.querySelectorAll('a, button')).filter(el => {
            const t = el.innerText.toLowerCase();
            const c = el.className;
            const a = el.getAttribute('aria-label') || '';
            return t.includes('next') || c.includes('next') || a.toLowerCase().includes('next');
        });
        
        result.selectors = nextAnchors.map(el => ({
            tag: el.tagName,
            classes: el.className,
            text: el.innerText.trim(),
            aria: el.getAttribute('aria-label'),
            href: el.href || null
        }));
        return result;
    });
    
    console.log(JSON.stringify(paginationInfo, null, 2));

    await browser.close();
}

run().catch(console.error);
