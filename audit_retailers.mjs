import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from './lib/google-auth.js';
import dotenv from 'dotenv';
dotenv.config();

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

async function auditRetailers() {
    const serviceAccountAuth = getGoogleAuth();
    const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();

    const retailers = [
        'Asda', 'Tesco', 'Sainsburys', 'Sainsbury\'s', 'Morrisons', 
        'Ocado', 'Waitrose', 'Sephora', 'Holland & Barrett', 'Superdrug'
    ];

    const sheets = ['Grocery', 'Beauty', 'News'];
    const results = {};

    for (const sheetTitle of sheets) {
        const sheet = doc.sheetsByTitle[sheetTitle];
        if (!sheet) continue;

        const rows = await sheet.getRows();
        for (const row of rows) {
            let retailer = row.get('retailer');
            if (!retailer) continue;
            retailer = retailer.trim();
            
            // Normalize Sainsbury's
            if (retailer === 'Sainsburys' || retailer === 'Sainsbury\'s') {
                retailer = 'Sainsbury\'s';
            }

            const timestamp = row.get('scrape_timestamp') || row.get('date_found');
            if (!timestamp) continue;

            const date = new Date(timestamp);
            if (isNaN(date.getTime())) continue;

            if (!results[retailer] || date > results[retailer].date) {
                results[retailer] = {
                    date: date,
                    sheet: sheetTitle,
                    product: row.get('product') || row.get('product_name')
                };
            }
        }
    }

    console.log('\n--- RETAILER AUDIT ---');
    console.log('| Retailer | Last Success | Sheet | Latest Product |');
    console.log('|----------|--------------|-------|----------------|');
    
    retailers.forEach(r => {
        const res = results[r];
        if (res) {
            console.log(`| ${r} | ${res.date.toISOString()} | ${res.sheet} | ${res.product} |`);
        } else {
            console.log(`| ${r} | NEVER | - | - |`);
        }
    });
}

auditRetailers().catch(console.error);
