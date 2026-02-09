
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from './lib/google-auth.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkSheet() {
    try {
        const auth = getGoogleAuth();
        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];

        const rows = await sheet.getRows();
        const runIds = [...new Set(rows.map(r => r.get('run_id')))];
        console.log('Recent Run IDs:', runIds.slice(-5));

        if (rows.length > 0) {
            const rowWithReviews = rows.find(r => r.get('reviews') && r.get('reviews') !== '0');
            if (rowWithReviews) {
                console.log('Found row with reviews:', rowWithReviews.get('product'), 'Reviews:', rowWithReviews.get('reviews'), 'Run:', rowWithReviews.get('run_id'));
            } else {
                console.log('No rows found in sheet with reviews > 0');
            }
        }
    } catch (e) {
        console.error(e);
    }
}

checkSheet();
