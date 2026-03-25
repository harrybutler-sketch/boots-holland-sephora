import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from '../lib/google-auth.js';
import dotenv from 'dotenv';
dotenv.config();

async function cleanGrocerySheet() {
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, getGoogleAuth());
    await doc.loadInfo();
    
    const sheet = doc.sheetsByTitle['Grocery'];
    const rows = await sheet.getRows();
    
    console.log(`Checking ${rows.length} rows in Grocery...`);
    let deleted = 0;
    
    for (const row of rows) {
        const retailer = row.get('Retailer') || row.get('retailer') || '';
        if (retailer.toLowerCase().includes('holland')) {
            await row.delete();
            deleted++;
            console.log(`Deleted row: ${row.get('product url')}`);
            // Small delay to avoid rate limiting
            await new Promise(r => setTimeout(r, 200));
        }
    }
    
    console.log(`Finished. Deleted ${deleted} Holland & Barrett rows from the Grocery tab.`);
}
cleanGrocerySheet();
