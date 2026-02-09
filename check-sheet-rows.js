
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from './lib/google-auth.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkSheetRows() {
    try {
        const auth = getGoogleAuth();
        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];

        const rows = await sheet.getRows();
        console.log(`Total rows in sheet: ${rows.length}`);

        if (rows.length > 0) {
            const last5 = rows.slice(-5);
            console.log('Last 5 rows:');
            last5.forEach(r => console.log(`- ${r.get('product')} (${r.get('retailer')})`));
        }

        const targetUrl = 'https://www.hollandandbarrett.com/shop/product/applied-nutrition-sleep-support-powder-mixed-berry-300g-6100012815';
        const exists = rows.find(r => r.get('product url') === targetUrl);
        console.log(`\nDoes '${targetUrl}' exist? ${!!exists}`);
        if (exists) {
            console.log(`Found in row with run_id: ${exists.get('run_id')}`);
        }

    } catch (e) {
        console.error(e);
    }
}

checkSheetRows();
