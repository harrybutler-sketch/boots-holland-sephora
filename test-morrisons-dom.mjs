import puppeteer from 'puppeteer';

async function testMorrisons() {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    console.log('Navigating...');
    await page.goto('https://groceries.morrisons.com/categories/new/192077?boolean=new&brands=Applied%20Nutrition&sortBy=favorite', { waitUntil: 'networkidle2' });
    
    console.log('Waiting for products...');
    await new Promise(r => setTimeout(r, 5000));
    
    const html = await page.evaluate(() => {
        // Find all links containing product
        const links = Array.from(document.querySelectorAll('a[href*="/products/"]'));
        return links.map(l => {
            // Get text and href
            return `${l.href} - Text: ${l.innerText.replace(/\n/g, ' ').substring(0, 50)}`;
        });
    });
    
    console.log(`Found ${html.length} raw product links:`);
    console.log(html.join('\n'));
    
    await browser.close();
}

testMorrisons();
