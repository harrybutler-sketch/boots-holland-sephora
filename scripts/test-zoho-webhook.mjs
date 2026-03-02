import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const webhookUrl = process.env.ZOHO_FLOW_WEBHOOK_URL;

if (!webhookUrl) {
    console.error('ZOHO_FLOW_WEBHOOK_URL not found in .env');
    process.exit(1);
}

const sanitize = (str) => {
    if (!str) return '';
    return str
        .replace(/&/g, ' and ')
        .replace(/'/g, ' ')
        .replace(/"/g, ' ')
        .replace(/[()]/g, ' ')
        .trim();
};

const sampleProducts = [
    {
        product: sanitize("No.1 Maitake Mushrooms 125g"),
        manufacturer: sanitize("Waitrose"),
        product_url: "https://www.waitrose.com/test1",
        retailer: "Waitrose",
        price: "GBP 2.00",
        image_url: "https://waitrose.com/img1",
        scrape_timestamp: new Date().toISOString(),
        tag: "new in",
        tags: ["new in"]
    },
    {
        product: sanitize("Joe&Seph's Toffee Gourmet Popcorn 135g"),
        manufacturer: sanitize("Joe & Seph's"),
        product_url: "https://www.waitrose.com/test2",
        retailer: "Waitrose",
        price: "GBP 4.00",
        image_url: "https://waitrose.com/img2",
        scrape_timestamp: new Date().toISOString(),
        tag: "new in",
        tags: ["new in"]
    },
    {
        product: sanitize("NoAddedSugar Cherries & Berries Cordial 500ml"),
        manufacturer: sanitize("Waitrose"),
        product_url: "https://www.waitrose.com/test3",
        retailer: "Waitrose",
        price: "GBP 1.50",
        image_url: "https://waitrose.com/img3",
        scrape_timestamp: new Date().toISOString(),
        tag: "new in",
        tags: ["new in"]
    }
];

async function sendTest() {
    console.log(`Starting multi-item test (3 items, 10s delay between each)...`);
    for (const [index, product] of sampleProducts.entries()) {
        console.log(`[${index + 1}/3] Sending: ${product.product}...`);
        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(product)
            });

            const result = await response.text();
            console.log(`Response Status: ${response.status}`);
            console.log(`Response Body: ${result}`);

            if (response.ok) {
                console.log(`✅ Success`);
            } else {
                console.log(`❌ Failure`);
            }
        } catch (error) {
            console.error('Error:', error);
        }

        if (index < sampleProducts.length - 1) {
            console.log('Waiting 10s...');
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }
}

sendTest();
