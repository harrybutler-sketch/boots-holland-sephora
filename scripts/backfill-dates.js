require('dotenv').config();
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

async function backfillDates() {
    console.log('📅 Backfilling Dates...');

    const serviceAccountAuth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];

    const rows = await sheet.getRows();
    console.log(`Fetched ${rows.length} rows.`);

    let updatedCount = 0;
    const today = new Date().toISOString().split('T')[0];

    for (const row of rows) {
        if (!row.get('date_found')) {
            row.set('date_found', today);
            updatedCount++;
        }
    }

    if (updatedCount > 0) {
        console.log(`Saving ${updatedCount} rows via batch update...`);
        // saveUpdatedCells saves all changes made to cells in the cache
        // effectively doing a bulk update
        await sheet.saveUpdatedCells();
        console.log('✅ Backfill complete!');
    } else {
        console.log('✅ No rows needed backfilling.');
    }
}

backfillDates();
