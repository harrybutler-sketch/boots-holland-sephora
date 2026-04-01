import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from './lib/google-auth.js';
import dotenv from 'dotenv';
dotenv.config();

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

async function checkGroceryAsda() {
    const serviceAccountAuth = getGoogleAuth();
    const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();

    const sheet = doc.sheetsByTitle['Grocery'];
    if (!sheet) {
        console.error('Grocery sheet not found');
        return;
    }

    const rows = await sheet.getRows();
    const asdaRows = rows.filter(r => r.get('retailer') === 'Asda');
    
    console.log(`Total Asda rows in Grocery: ${asdaRows.length}`);
    
    const recentAsda = asdaRows.sort((a, b) => {
        const dateA = new Date(a.get('scrape_timestamp') || a.get('date_found'));
        const dateB = new Date(b.get('scrape_timestamp') || b.get('date_found'));
        return dateB - dateA;
    }).slice(0, 10);
    
    console.log('\nRecent Asda entries in Grocery:');
    recentAsda.forEach(r => {
        console.log(`- Product: ${r.get('product')} | Date: ${r.get('date_found')} | Time: ${r.get('scrape_timestamp')} | RunID: ${r.get('run_id')}`);
    });
}

checkGroceryAsda().catch(console.error);
