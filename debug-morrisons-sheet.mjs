import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from './lib/google-auth.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkMorrisonsInSheet() {
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, getGoogleAuth());
    await doc.loadInfo();
    
    const sheet = doc.sheetsByTitle['Grocery'];
    const rows = await sheet.getRows();
    
    const morrisonsRows = rows.filter(r => (r.get('retailer') || '').includes('Morrisons'));
    console.log(`Grocery sheet has ${morrisonsRows.length} Morrisons items.`);
    
    // Sort by date added
    morrisonsRows.sort((a, b) => new Date(b.get('scrape_timestamp') || 0) - new Date(a.get('scrape_timestamp') || 0));
    
    if (morrisonsRows.length > 0) {
        console.log('\nLast 5 items added:');
        morrisonsRows.slice(0, 5).forEach(r => {
            console.log(`- ${r.get('product')} (Brand: ${r.get('brand')}) [${r.get('scrape_timestamp')}]`);
        });
    }
}
checkMorrisonsInSheet();
