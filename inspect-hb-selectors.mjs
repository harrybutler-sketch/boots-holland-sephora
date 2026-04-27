import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

puppeteer.use(StealthPlugin());

async function inspectHB() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
        console.log('Navigating to Holland & Barrett...');
        await page.goto('https://www.hollandandbarrett.com/shop/highlights/new-in/', { waitUntil: 'networkidle2' });
        
        // Wait for products to load
        await new Promise(r => setTimeout(r, 5000));
        
        // Grab all class names of elements that look like product cards
        const classReport = await page.evaluate(() => {
            const elements = document.querySelectorAll('div, section, article');
            const counts = {};
            elements.forEach(el => {
                if (el.className && typeof el.className === 'string') {
                    const classes = el.className.split(/\s+/);
                    classes.forEach(c => {
                        if (c.toLowerCase().includes('product')) {
                            counts[c] = (counts[c] || 0) + 1;
                        }
                    });
                }
            });
            return counts;
        });
        
        console.log('Product-related class counts:', classReport);
        
        const html = await page.content();
        fs.writeFileSync('hb_listing.html', html);
        console.log('Saved HTML to hb_listing.html');
        
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await browser.close();
    }
}

inspectHB();
