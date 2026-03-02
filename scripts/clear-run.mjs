import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from '../lib/google-auth.js';
import dotenv from 'dotenv';
dotenv.config();

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

async function clearRun(runId) {
    if (!runId) {
        console.error('Usage: node scripts/clear-run.mjs <runId>');
        process.exit(1);
    }

    console.log(`\n=== Clearing rows for Run: ${runId} ===`);

    const auth = getGoogleAuth();
    const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, auth);
    await doc.loadInfo();

    const sheets = [doc.sheetsByTitle['Grocery'], doc.sheetsByTitle['New In']];

    for (const sheet of sheets) {
        if (!sheet) continue;
        console.log(`Checking sheet: ${sheet.title}...`);
        const rows = await sheet.getRows();

        // Find rows to delete (Run ID or run_id)
        const rowsToDelete = rows.filter(row => {
            const id = row.get('run_id') || row.get('Run ID');
            return id === runId;
        });

        if (rowsToDelete.length > 0) {
            console.log(`Found ${rowsToDelete.length} rows to delete in ${sheet.title}. Deleting...`);
            // Delete in reverse order to keep indices valid if using index-based delete, 
            // but google-spreadsheet row.delete() handles itself.
            for (const row of rowsToDelete) {
                await row.delete();
            }
            console.log(`✅ Deleted ${rowsToDelete.length} rows from ${sheet.title}.`);
        } else {
            console.log(`No rows found for ${runId} in ${sheet.title}.`);
        }
    }

    console.log('\nDone clearing.');
}

const args = process.argv.slice(2);
clearRun(args[0]);
