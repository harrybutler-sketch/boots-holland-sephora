import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from './lib/google-auth.js';
import dotenv from 'dotenv';
dotenv.config();

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

async function checkAllSheets() {
    const serviceAccountAuth = getGoogleAuth();
    const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();

    console.log('Available Sheets:');
    for (const title in doc.sheetsByTitle) {
        const sheet = doc.sheetsByTitle[title];
        const rows = await sheet.getRows();
        console.log(`- ${title}: ${rows.length} rows`);
        
        const retailers = new Set(rows.map(r => r.get('retailer')));
        if (retailers.size > 0) {
            console.log(`  Retailers: ${Array.from(retailers).join(', ')}`);
        }
    }
}

checkAllSheets().catch(console.error);
