import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const envMap = {};
try {
    const envFile = fs.readFileSync(path.resolve('.env'), 'utf8');
    envFile.split('\n').filter(Boolean).forEach(line => {
        const idx = line.indexOf('=');
        if (idx > -1) {
            envMap[line.substring(0, idx)] = line.substring(idx + 1).replace(/^"|"$/g, '').replace(/^'|'$/g, '');
        }
    });
} catch(e) {}

const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || envMap.GOOGLE_SERVICE_ACCOUNT_EMAIL;
let key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || envMap.GOOGLE_SERVICE_ACCOUNT_KEY;
if (key) key = key.replace(/\\n/g, '\n');
const sheetId = process.env.GOOGLE_SHEET_ID || envMap.GOOGLE_SHEET_ID;

const auth = new JWT({
    email: email,
    key: key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function importSpecific() {
    const doc = new GoogleSpreadsheet(sheetId, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle['Beauty'];
    
    // Parse item_full.json
    const content = fs.readFileSync('item_full.json', 'utf8');
    const regex = /\{[\s\S]*\}/;
    const match = content.match(regex);
    if (!match) {
        console.error('No JSON found in item_full.json');
        return;
    }
    
    // Convert the stringified JS object into actual JSON
    // The previous cat output showed it was a raw console.log printout
    // We'll manually extract the key fields
    const text = match[0];
    const extract = (key) => {
        const m = text.match(new RegExp(`\\s+${key}: '(.*?)'`, 'i'));
        return m ? m[1] : '';
    };

    const product = extract('name');
    const url = extract('url');
    const brand = extract('brand').match(/slogan: '(.*?)'/)?.[1] || extract('brand') || '';
    const price = text.match(/price: '(.*?)'/)?.[1] || '';

    if (!product || !url) {
        console.error('Could not extract basic product info');
        return;
    }

    const row = {
        'date_found': new Date().toISOString().split('T')[0],
        'retailer': 'Sephora',
        'manufacturer': brand,
        'product': product,
        'brand': brand,
        'price': `GBP ${price}`,
        'reviews': 192,
        'rating_value': 4.88,
        'product url': url,
        'status': 'New',
        'run_id': 'manual-pull-fix',
        'scrape_timestamp': new Date().toISOString()
    };

    console.log('Adding product to Beauty tab:', product);
    await sheet.addRow(row);
    console.log('Success!');
}

importSpecific().catch(console.error);
