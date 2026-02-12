
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from './lib/google-auth.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkSheet() {
    try {
        const auth = getGoogleAuth();
        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
        await doc.loadInfo();
        const sheetsToCheck = ['New In', 'Grocery'];

        for (const sheetTitle of sheetsToCheck) {
            const sheet = doc.sheetsByTitle[sheetTitle];
            if (!sheet) continue;

            console.log(`\n--- Checking Sheet: ${sheetTitle} ---`);
            const rows = await sheet.getRows();
            console.log(`Total Rows: ${rows.length}`);

            if (rows.length === 0) continue;

            // Log a few samples with reviews
            const withReviews = rows.filter(r => parseInt(r.get('reviews') || '0') > 0);
            console.log(`Rows with reviews > 0: ${withReviews.length}`);

            if (withReviews.length > 0) {
                console.log('Samples with reviews:');
                withReviews.slice(0, 3).forEach(r => {
                    console.log(`- ${r.get('product')}: ${r.get('reviews')} reviews (Retailer: ${r.get('retailer')})`);
                });
            }

            // Log a few samples without reviews (potential new launches)
            const withoutReviews = rows.filter(r => !r.get('reviews') || r.get('reviews') === '0');
            console.log(`Rows with reviews = 0: ${withoutReviews.length}`);
            if (withoutReviews.length > 0) {
                console.log('Samples with 0 reviews (Launch candidates):');
                withoutReviews.slice(0, 3).forEach(r => {
                    console.log(`- ${r.get('product')} (Retailer: ${r.get('retailer')})`);
                });
            }
        }
    } catch (e) {
        console.error(e);
    }
}

checkSheet();
