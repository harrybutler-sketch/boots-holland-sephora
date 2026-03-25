import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from './lib/google-auth.js';
import dotenv from 'dotenv';
dotenv.config();

async function findHB() {
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, getGoogleAuth());
    await doc.loadInfo();
    
    const sheets = ['Grocery', 'New In'];
    for (const title of sheets) {
        const sheet = doc.sheetsByTitle[title];
        if (sheet) {
            const rows = await sheet.getRows();
            const hbRows = rows.filter(r => (r.get('retailer') || '').includes('Holland'));
            console.log(`Sheet "${title}" has ${hbRows.length} Holland & Barrett items.`);
        }
    }
}
findHB();
