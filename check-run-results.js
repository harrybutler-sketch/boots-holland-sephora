import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from './lib/google-auth.js';
import dotenv from 'dotenv';
dotenv.config();

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

async function checkRunSyncResults() {
    const runId = '6ktY1LtRkjWp8h5TF';
    console.log(`Checking results for run ${runId} in Google Sheets...`);
    
    const serviceAccountAuth = getGoogleAuth();
    const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();

    const sheets = ['Grocery', 'New In'];
    for (const title of sheets) {
        const sheet = doc.sheetsByTitle[title];
        if (!sheet) continue;
        
        const rows = await sheet.getRows();
        const runRows = rows.filter(r => r.get('run_id') === runId);
        console.log(`Run ${runId} found in ${title}: ${runRows.length} rows`);
        if (runRows.length > 0) {
            runRows.slice(0, 5).forEach(r => {
                console.log(`- Retailer: ${r.get('retailer')} | Product: ${r.get('product')}`);
            });
        }
    }
}

checkRunSyncResults().catch(console.error);
