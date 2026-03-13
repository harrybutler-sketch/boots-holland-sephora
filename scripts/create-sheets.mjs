import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from '../lib/google-auth.js';
import dotenv from 'dotenv';
dotenv.config();

async function createSheets() {
    const serviceAccountAuth = getGoogleAuth();
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();

    const requiredSheets = [
        { title: 'LinkedIn', headers: ['id', 'brand', 'product', 'manufacturer', 'manufacturer url', 'date', 'retailer', 'post snippet', 'type', 'dealtWith', 'post url'] },
        { title: 'News', headers: ['id', 'source', 'headline', 'snippet', 'article url', 'date', 'brand', 'product', 'retailer', 'type', 'dealtWith'] }
    ];

    for (const sheetDef of requiredSheets) {
        if (!doc.sheetsByTitle[sheetDef.title]) {
            console.log(`Creating sheet: ${sheetDef.title}`);
            const newSheet = await doc.addSheet({ title: sheetDef.title, headerValues: sheetDef.headers });
            console.log(`Created ${newSheet.title}`);
        } else {
            console.log(`Sheet ${sheetDef.title} already exists. Setting headers...`);
            await doc.sheetsByTitle[sheetDef.title].setHeaderRow(sheetDef.headers);
        }
    }
}

createSheets().catch(console.error);
