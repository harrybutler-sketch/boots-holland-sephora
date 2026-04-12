import { GoogleSpreadsheet } from 'google-spreadsheet';
import dotenv from 'dotenv';
import { getGoogleAuth } from './lib/google-auth.js';

dotenv.config();

async function fix() {
    console.log('Loading doc...');
    const auth = getGoogleAuth();
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle['LinkedIn'];

    const headers = [
        'id', 'brand', 'product', 'manufacturer', 'manufacturer url', 
        'date', 'retailer', 'type', 'post snippet', 'dealtWith', 
        'post url', 'scrape_timestamp'
    ];

    console.log('Inserting row at the top...');
    try {
        await sheet.insertDimension('ROWS', { startIndex: 0, endIndex: 1 });
        console.log('Inserted row successfully.');
    } catch (e) {
        console.error('Could not insert row (maybe version mismatch). Will just overwrite row 1 instead.', e.message);
    }

    console.log('Setting headers...');
    await sheet.setHeaderRow(headers);
    console.log('Headers set successfully!');
}

fix().catch(console.error);
