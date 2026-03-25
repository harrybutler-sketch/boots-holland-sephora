import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from './lib/google-auth.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, getGoogleAuth());
    await doc.loadInfo();
    console.log('Available sheets:');
    Object.keys(doc.sheetsByTitle).forEach(t => console.log(` - ${t}`));
}
check();
