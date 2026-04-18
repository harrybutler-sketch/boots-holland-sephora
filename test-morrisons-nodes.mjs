import puppeteer from 'puppeteer';

async function testMorrisons() {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    console.log('Navigating...');
    await page.goto('https://groceries.morrisons.com/categories/fresh-chilled-foods/176739?boolean=new&sortBy=favorite', { waitUntil: 'networkidle2' });
    
    console.log('Waiting for products...');
    await new Promise(r => setTimeout(r, 5000));
    
    const html = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/products/"]'));
        return links.map(l => {
            let pNodeName = l.parentElement ? l.parentElement.nodeName : '';
            let pClasses = l.parentElement ? l.parentElement.className : '';
            return `${l.href} - Parent: ${pNodeName}.${pClasses}`;
        });
    });
    
    console.log(html.join('\n'));
    await browser.close();
}

testMorrisons();
