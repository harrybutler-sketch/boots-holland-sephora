import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from './lib/google-auth.js';
import dotenv from 'dotenv';
dotenv.config();

async function findHB() {
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, getGoogleAuth());
    await doc.loadInfo();
    
    const sheet = doc.sheetsByTitle['Grocery'];
    const rows = await sheet.getRows();
    const hbRows = rows.filter(r => (r.get('retailer') || '').includes('Holland') || (r.get('product url')||'').includes('holland'));
    
    hbRows.slice(0, 5).forEach(r => {
        console.log(`URL: ${r.get('product url')}`);
        console.log(`Retailer: ${r.get('retailer')}`);
        console.log(`---`);
    });
}
findHB();
