
import { ApifyClient } from 'apify-client';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

async function fetchHtml() {
    try {
        console.log('Fetching HTML for H&B product...');
        // using apify/puppeteer-scraper for full browser rendering
        const run = await client.actor('apify/puppeteer-scraper').start({
            startUrls: [{
                url: 'https://www.hollandandbarrett.com/shop/product/weleda-skin-food-glow-serum-drops-30ml-6100008114',
                userData: { retailer: 'Holland & Barrett' }
            }],
            pageFunction: async ({ page, request }) => {
                // Return HTML
                const html = await page.content();
                return { html };
            },
            proxyConfiguration: {
                useApifyProxy: true
            }
        });

        console.log(`Run started: ${run.id}`);

        // Poll for completion
        let status = 'RUNNING';
        while (status === 'RUNNING' || status === 'READY') {
            await new Promise(resolve => setTimeout(resolve, 5000));
            const runInfo = await client.run(run.id).get();
            status = runInfo.status;
            console.log(`Status: ${status}`);
        }

        if (status === 'SUCCEEDED') {
            const dataset = await client.run(run.id).dataset();
            const { items } = await dataset.listItems();
            if (items.length > 0 && items[0].html) {
                await fs.promises.writeFile('hb_product.html', items[0].html);
                console.log('HTML saved to hb_product.html');
            } else {
                console.log('No HTML returned.');
            }
        } else {
            console.log('Run failed.');
        }

    } catch (e) {
        console.error(e);
    }
}

fetchHtml();
