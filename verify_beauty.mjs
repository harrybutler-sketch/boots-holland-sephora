import { getGoogleAuth } from './lib/google-auth.js';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import dotenv from 'dotenv';
dotenv.config();

const serviceAccountAuth = getGoogleAuth();

async function checkBeautyTab() {
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle['Beauty'];
    await sheet.loadHeaderRow();
    const rows = await sheet.getRows();
    console.log(`Headers: ${sheet.headerValues.join(', ')}`);
    console.log(`Beauty tab has ${rows.length} rows.`);
    console.log('Last row product name:', rows[rows.length - 1].get('Product'));
}

checkBeautyTab().catch(console.error);
