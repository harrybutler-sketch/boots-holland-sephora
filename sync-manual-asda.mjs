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
    "name": "Green Giant Hearts of Palm 400g",
    "price": "2.55",
    "reviews": "1",
    "url": "https://groceries.asda.com/product/tinned-vegetables/green-giant-hearts-of-palm-400g/3229944",
    "image": "https://ui.assets-asda.com/v8/944/229/3229944_IDShot_3.jpg"
  },
  {
    "name": "Kellogg's Rice Krispies Breakfast Cereal 310g",
    "price": "2.35",
    "reviews": "4",
    "url": "https://groceries.asda.com/product/family-cereals/kellogg-s-rice-krispies-breakfast-cereal-310g/7673261",
    "image": "https://ui.assets-asda.com/v8/261/673/7673261_IDShot_3.jpg"
  },
  {
    "name": "Jordans Protein Boost Granola Chocolate & Hazelnut 400g",
    "price": "3.60",
    "reviews": "5",
    "url": "https://groceries.asda.com/product/granola-crisp/jordans-protein-boost-granola-chocolate-hazelnut-400g/9341029",
    "image": "https://ui.assets-asda.com/v8/029/341/9341029_IDShot_3.jpg"
  },
  {
    "name": "Pot Noodle Original Curry Instant Noodles Block 114 g",
    "price": "1.00",
    "reviews": "6",
    "url": "https://groceries.asda.com/product/packet-noodles/pot-noodle-original-curry-instant-noodles-block-114-g/9342416",
    "image": "https://ui.assets-asda.com/v8/416/342/9342416_IDShot_3.jpg"
  },
  {
    "name": "Nestle Cheerios Very Berry Multigrain Breakfast Cereal 435g",
    "price": "3.50",
    "reviews": "183",
    "url": "https://groceries.asda.com/product/family-cereals/nestle-cheerios-very-berry-multigrain-breakfast-cereal-435g/9318555",
    "image": "https://ui.assets-asda.com/v8/555/318/9318555_IDShot_3.jpg"
  },
  {
    "name": "Jordans Protein Boost Granola Red Berry 400g",
    "price": "3.60",
    "reviews": "3",
    "url": "https://groceries.asda.com/product/granola-crisp/jordans-protein-boost-granola-red-berry-400g/9344140",
    "image": "https://ui.assets-asda.com/v8/140/344/9344140_IDShot_3.jpg"
  },
  {
    "name": "Pot Noodle Bombay Bad Boy Instant Noodles Block 115 g",
    "price": "1.00",
    "reviews": "2",
    "url": "https://groceries.asda.com/product/packet-noodles/pot-noodle-bombay-bad-boy-instant-noodles-block-115-g/9341224",
    "image": "https://ui.assets-asda.com/v8/224/341/9341224_IDShot_3.jpg"
  },
  {
    "name": "Mutti Pizza Sauce Aromatica 400g",
    "price": "1.40",
    "reviews": "3",
    "url": "https://groceries.asda.com/product/olives-antipasti-pizza-bases/mutti-pizza-sauce-aromatica-400g/6711623",
    "image": "https://ui.assets-asda.com/v8/623/711/6711623_IDShot_3.jpg"
  },
  {
    "name": "Jordans Special Edition Crunchy Oat Clusters Caramelised Biscuit 450g",
    "price": "3.75",
    "reviews": "11",
    "url": "https://groceries.asda.com/product/family-cereals/jordans-special-edition-crunchy-oat-clusters-with-caramelised-biscuit-pieces-450g/9344566",
    "image": "https://ui.assets-asda.com/v8/566/344/9344566_IDShot_3.jpg"
  },
  {
    "name": "Quaker Oat So Simple Original Big Pack 12x27g",
    "price": "2.50",
    "reviews": "10",
    "url": "https://groceries.asda.com/product/sachets-boxes-bags/quaker-oat-so-simple-original-big-pack-porridge-sachets-12x27g/9346792",
    "image": "https://ui.assets-asda.com/v8/792/346/9346792_IDShot_3.jpg"
  },
  {
    "name": "Quaker Oat So Simple Original Big Pack 22x27g",
    "price": "4.00",
    "reviews": "5",
    "url": "https://groceries.asda.com/product/sachets-boxes-bags/quaker-oat-so-simple-original-big-pack-porridge-sachets-22-x-27g/9346702",
    "image": "https://ui.assets-asda.com/v8/702/346/9346702_IDShot_3.jpg"
  },
  {
    "name": "Batchelors Super Pasta Bolognese 45g",
    "price": "1.00",
    "reviews": "2",
    "url": "https://groceries.asda.com/product/packet-noodles/batchelors-super-pasta-bolognese-45g/9341052",
    "image": "https://ui.assets-asda.com/v8/052/341/9341052_IDShot_3.jpg"
  },
  {
    "name": "Lyles Squeezy Syrup Butterscotch 325g",
    "price": "1.75",
    "reviews": "20",
    "url": "https://groceries.asda.com/product/syrups-toppings/lyles-squeezy-syrup-butterscotch-325g/2261765",
    "image": "https://ui.assets-asda.com/v8/765/261/2261765_IDShot_3.jpg"
  },
  {
    "name": "Asda Salted Toffee Sauce 340g",
    "price": "1.40",
    "reviews": "5",
    "url": "https://groceries.asda.com/product/syrups-toppings/asda-salted-toffee-sauce-340g/1000216781232",
    "image": "https://ui.assets-asda.com/v1/232/781/1000216781232_IDShot_3.jpg"
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
