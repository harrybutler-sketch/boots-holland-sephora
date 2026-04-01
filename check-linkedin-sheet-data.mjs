import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from './lib/google-auth.js';
import dotenv from 'dotenv';
dotenv.config();

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

async function checkLinkedinSheet() {
    console.log('--- Checking LinkedIn Sheet Data ---');
    try {
        const serviceAccountAuth = getGoogleAuth();
        const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();

        const sheet = doc.sheetsByTitle['LinkedIn'];
        if (!sheet) {
            console.error('LinkedIn sheet not found!');
            return;
        }

        const rows = await sheet.getRows();
        console.log(`Total rows in LinkedIn sheet: ${rows.length}`);

        console.log('\nLatest 5 entries:');
        rows.slice(-5).reverse().forEach(row => {
            console.log(`- [${row.get('date')}] ${row.get('manufacturer')}: ${row.get('product')} (${row.get('retailer')}) | Dealt: ${row.get('dealtWith')}`);
        });

        // Also check if any are marked as TRUE for dealtWith but should be False?
        // Or if they are outside the 28-day window.
        const fourWeeksAgo = new Date();
        fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
        
        const recentCount = rows.filter(r => {
            const d = new Date(r.get('date'));
            return d >= fourWeeksAgo;
        }).length;
        
        console.log(`\nItems from the last 28 days: ${recentCount}`);

    } catch (error) {
        console.error('Error checking sheet:', error.message);
    }
}

checkLinkedinSheet();
