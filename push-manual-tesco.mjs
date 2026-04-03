
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from './lib/google-auth.js';
import dotenv from 'dotenv';
dotenv.config();

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

const products = [
  { "name": "Cauldron Express Smoky BBQ Grillable Tofu Block 180g", "price": "£2.30", "url": "https://www.tesco.com/groceries/en-GB/products/323000092" },
  { "name": "Cauldron Express Oregano & Thyme Grillable Tofu Block 180g", "price": "£2.30", "url": "https://www.tesco.com/groceries/en-GB/products/322991353" },
  { "name": "Cauldron Extra Firm Tofu Block 200g", "price": "£1.75", "url": "https://www.tesco.com/groceries/en-GB/products/323489048" },
  { "name": "Cauldron Express Teriyaki Organic Tofu Pieces 160g", "price": "£2.75", "url": "https://www.tesco.com/groceries/en-GB/products/323002781" },
  { "name": "all plants Sweet Potato and Black Bean Protein Veggie Burger 180g", "price": "£3.50", "url": "https://www.tesco.com/groceries/en-GB/products/323309009" },
  { "name": "Strong Roots Sweet Potato Hash Brown 350G", "price": "£3.30", "url": "https://www.tesco.com/groceries/en-GB/products/311216304" },
  { "name": "BOSH! Comforting Veg Pie with Lentils & Sliced Potato 400g", "price": "£3.75", "url": "https://www.tesco.com/groceries/en-GB/products/323303655" },
  { "name": "Linda McCartney Vegan Shredded Chicken 260g", "price": "£2.75", "url": "https://www.tesco.com/groceries/en-GB/products/322997785" },
  { "name": "Linda McCartney Shredded Hoisin Duck Vegan 260g", "price": "£2.75", "url": "https://www.tesco.com/groceries/en-GB/products/323003503" },
  { "name": "THIS Isn't Beef Plant-Based Mince 280g", "price": "£3.50", "url": "https://www.tesco.com/groceries/en-GB/products/316941747" },
  { "name": "all plants Chickpea, Pea & Lemon zest Protein Veggie Burger 180g", "price": "£3.50", "url": "https://www.tesco.com/groceries/en-GB/products/323169456" },
  { "name": "all plants Veggie Tempeh with pea and rosemary 180g", "price": "£3.00", "url": "https://www.tesco.com/groceries/en-GB/products/322552712" },
  { "name": "all plants Veggie Tempeh with golden lentils 180g", "price": "£3.00", "url": "https://www.tesco.com/groceries/en-GB/products/323151494" },
  { "name": "all plants Tofu Goujons with spinach 160g", "price": "£3.50", "url": "https://www.tesco.com/groceries/en-GB/products/323159704" },
  { "name": "The Tofoo Co. Dippers Crispy Crumb 160g", "price": "£2.50", "url": "https://www.tesco.com/groceries/en-GB/products/322997065" },
  { "name": "BOSH! Hearty Veg Lasagne with Rich Vegetable & Soya Ragu 400g", "price": "£3.75", "url": "https://www.tesco.com/groceries/en-GB/products/323165265" },
  { "name": "Greggs 4 Vegan Sausage Roll 420g", "price": "£3.50", "url": "https://www.tesco.com/groceries/en-GB/products/323324705" },
  { "name": "Dr Oetker Ristorante Vegan Margherita Pomodori Pizza 340g", "price": "£3.50", "url": "https://www.tesco.com/groceries/en-GB/products/322822935" },
  { "name": "Quorn Vegetarian Strips 300g", "price": "£2.60", "url": "https://www.tesco.com/groceries/en-GB/products/323014496" },
  { "name": "BOSH! Tofu Tikka Masala with Spice Grain Medley 400g", "price": "£3.75", "url": "https://www.tesco.com/groceries/en-GB/products/323143550" }
];

async function pushManual() {
    try {
        const serviceAccountAuth = getGoogleAuth();
        const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();

        const sheet = doc.sheetsByTitle['Grocery'];
        if (!sheet) throw new Error('Grocery sheet not found');

        const rows = products.map(p => ({
            'date_found': new Date().toISOString().split('T')[0],
            'retailer': 'Tesco',
            'product': p.name,
            'price': p.price,
            'product url': p.url,
            'status': 'New',
            'run_id': 'MANUAL_EXTRACTION',
            'scrape_timestamp': new Date().toISOString()
        }));

        console.log(`Adding ${rows.length} manual products to Grocery sheet...`);
        await sheet.addRows(rows);
        console.log('Success!');

    } catch (err) {
        console.error('Manual Push Error:', err);
    }
}

pushManual();
