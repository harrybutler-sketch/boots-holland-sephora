import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from './lib/google-auth.js';
import dotenv from 'dotenv';
dotenv.config();

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

if (!GOOGLE_SHEET_ID) {
    console.error('Missing GOOGLE_SHEET_ID!');
    process.exit(1);
}

const items = [
  {
    "name": "Baileys White Chocolate Flavour with Raspberry Liqueur 50cl",
    "price": "11.00",
    "reviews": "7",
    "url": "https://www.asda.com/groceries/event/new-beer-wine-spirits",
    "image": ""
  },
  {
    "name": "Smirnoff Crush Mango And Peach Vodka Mixed Drink 440ml",
    "price": "3.60",
    "reviews": "49",
    "url": "https://www.asda.com/groceries/event/new-beer-wine-spirits",
    "image": ""
  },
  {
    "name": "Chouffe Cherry 0.0% 330ml",
    "price": "1.75",
    "reviews": "0",
    "url": "https://www.asda.com/groceries/event/new-beer-wine-spirits",
    "image": ""
  },
  {
    "name": "All (Good) Things Marlborough Sauvignon Blanc 75cl",
    "price": "9.00",
    "reviews": "0",
    "url": "https://www.asda.com/groceries/event/new-beer-wine-spirits",
    "image": ""
  },
  {
    "name": "Suntory -196 Peach Vodka, Soda & Shochu Ready To Drink Can 330ml",
    "price": "2.20",
    "reviews": "0",
    "url": "https://www.asda.com/groceries/event/new-beer-wine-spirits",
    "image": ""
  },
  {
    "name": "Kirkstall Imperial Stout Chocolate Orange 440ml",
    "price": "3.72",
    "reviews": "0",
    "url": "https://www.asda.com/groceries/event/new-beer-wine-spirits",
    "image": ""
  },
  {
    "name": "Badger Iron Hart Pale Ale 500ml",
    "price": "2.75",
    "reviews": "0",
    "url": "https://www.asda.com/groceries/event/new-beer-wine-spirits",
    "image": ""
  },
  {
    "name": "Nightjar British Stout Smooth 4 x 440ml",
    "price": "6.75",
    "reviews": "0",
    "url": "https://www.asda.com/groceries/event/new-beer-wine-spirits",
    "image": ""
  },
  {
    "name": "Seven Bro7hers Double IPA Krush Dipa 440ml",
    "price": "3.75",
    "reviews": "0",
    "url": "https://www.asda.com/groceries/event/new-beer-wine-spirits",
    "image": ""
  },
  {
    "name": "Big Hug Jacked 440ml",
    "price": "3.25",
    "reviews": "0",
    "url": "https://www.asda.com/groceries/event/new-beer-wine-spirits",
    "image": ""
  },
  {
    "name": "BrewDog Emerald Daze Terpene Infused Hazy IPA 440ml",
    "price": "3.80",
    "reviews": "0",
    "url": "https://www.asda.com/groceries/event/new-beer-wine-spirits",
    "image": ""
  },
  {
    "name": "Jacob's Creek Sauvignon Blanc White Wine Zesty & Fresh 75cl",
    "price": "7.50",
    "reviews": "0",
    "url": "https://www.asda.com/groceries/event/new-beer-wine-spirits",
    "image": ""
  },
  {
    "name": "Schöfferhofer Hefeweizen Premium Wheat Beer 0.5L",
    "price": "1.85",
    "reviews": "0",
    "url": "https://www.asda.com/groceries/event/new-beer-wine-spirits",
    "image": ""
  },
  {
    "name": "Jacob's Creek Rosé Wine Refreshing & Lively 75cl",
    "price": "7.50",
    "reviews": "0",
    "url": "https://www.asda.com/groceries/event/new-beer-wine-spirits",
    "image": ""
  }
];

async function syncManualItems() {
    try {
        console.log(`\n=== Manual Syncing ${items.length} Asda Items ===`);
        
        console.log('Getting Google Auth...');
        const serviceAccountAuth = getGoogleAuth();
        console.log('Loading Spreadsheet...');
        const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();
        console.log('Spreadsheet loaded:', doc.title);

        const grocerySheet = doc.sheetsByTitle['Grocery'];
        if (!grocerySheet) {
            console.error('Grocery sheet not found!');
            return;
        }
        console.log('Grocery sheet found. Loading rows...');

        const rows = await grocerySheet.getRows();
        console.log(`Found ${rows.length} existing rows in Grocery sheet.`);
        
        const existingUrls = new Set(rows.map(r => r.get('product url') || r.get('Product URL')));
        console.log(`Unique URLs in sheet: ${existingUrls.size}`);
        
        const newRows = [];
        let skippedOwnBrand = 0;
        let skippedHighReviews = 0;
        let duplicateCount = 0;

        const ownBrandKeywords = ['asda', 'extra special', 'just essentials', 'smart price', 'farm stores'];

        for (const item of items) {
            if (existingUrls.has(item.url)) {
                duplicateCount++;
                continue;
            }

            const reviews = parseInt(item.reviews) || 0;
            if (reviews > 5) {
                skippedHighReviews++;
                continue;
            }

            const name = item.name;
            const isOwnBrand = ownBrandKeywords.some(kw => name.toLowerCase().includes(kw));
            if (isOwnBrand) {
                skippedOwnBrand++;
                continue;
            }

            // Extract brand (first word or first two words)
            const words = name.split(' ');
            let brand = words[0];
            if (words[1] && /^[A-Z]/.test(words[1])) {
                brand = words.slice(0, 2).join(' ');
            }

            const rowData = {
                'date_found': new Date().toISOString().split('T')[0],
                'retailer': 'Asda',
                'manufacturer': brand,
                'product': name,
                'brand': brand,
                'price': `GBP ${item.price}`,
                'reviews': reviews,
                'rating_value': 0,
                'product url': item.url,
                'status': 'New',
                'run_id': 'manual-browser-scrape',
                'scrape_timestamp': new Date().toISOString(),
                'category': 'Grocery',
                'image_url': item.image
            };

            newRows.push(rowData);
            existingUrls.add(item.url);
        }

        if (newRows.length > 0) {
            console.log(`Adding ${newRows.length} rows to Grocery...`);
            await grocerySheet.addRows(newRows);
            console.log('Rows added successfully.');
        } else {
            console.log('No new rows to add.');
        }

        console.log(`\n=== Sync Results ===`);
        console.log(`Processed:           ${items.length}`);
        console.log(`Added:               ${newRows.length}`);
        console.log(`Duplicates skipped:  ${duplicateCount}`);
        console.log(`Own Brand skipped:   ${skippedOwnBrand}`);
        console.log(`High reviews (>5) skipped: ${skippedHighReviews}`);

    } catch (e) {
        console.error('Sync Error:', e);
    }
}

syncManualItems();
