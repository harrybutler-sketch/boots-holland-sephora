
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const RUN_ID = 'pmJZmZWOLDnmkY1ES';

async function interact() {
    const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
    const dataset = await client.run(RUN_ID).dataset();
    const { items } = await dataset.listItems();

    console.log(`Scanning ${items.length} items for 'Marketplace'...`);

    const badItems = items.filter(item => {
        // Check standard fields we map to manufacturer
        const m = item.manufacturer || item.vendor || item.merchant || item.brand;
        const s = JSON.stringify(m).toLowerCase();
        return s.includes('marketplace');
    });

    if (badItems.length > 0) {
        console.log(`Found ${badItems.length} items with 'Marketplace' data.`);
        console.log('--- RAW ITEM SAMPLE ---');
        console.log(JSON.stringify(badItems[0], null, 2));
    } else {
        console.log("No items found with explicit 'Marketplace' string in manufacturer fields. Checking fallbacks...");
        // If not explicit, maybe our logic derived it? 
        // Let's filter by title from screenshot?
        const specific = items.find(i => i.title && i.title.includes('Second Nature Pop Ups'));
        if (specific) {
            console.log('--- SPECIFIC ITEM FROM SCREENSHOT ---');
            console.log(JSON.stringify(specific, null, 2));
        }
    }
}

interact();
