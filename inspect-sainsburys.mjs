import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

puppeteer.use(StealthPlugin());

async function inspectSainsburys() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
        console.log('Navigating to Sainsbury\'s New In...');
        // Using a common New In URL for Sainsbury's
        await page.goto('https://www.sainsburys.co.uk/gol-ui/features/new-in-chilled', { waitUntil: 'networkidle2' });
        
        await new Promise(r => setTimeout(r, 5000));
        
        const classReport = await page.evaluate(() => {
            const elements = document.querySelectorAll('div, section, article, li');
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
        fs.writeFileSync('sainsburys_listing.html', html);
        console.log('Saved HTML to sainsburys_listing.html');
        
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await browser.close();
    }
}

inspectSainsburys();
