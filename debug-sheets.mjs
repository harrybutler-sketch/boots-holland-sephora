import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

const envMap = {};
try {
    const envFile = fs.readFileSync(path.resolve('.env'), 'utf8');
    envFile.split('\n').filter(Boolean).forEach(line => {
        const idx = line.indexOf('=');
        if (idx > -1) {
            envMap[line.substring(0, idx)] = line.substring(idx + 1).replace(/^"|"$/g, '').replace(/^'|'$/g, '');
        }
    });
} catch(e) {}

const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || envMap.GOOGLE_SERVICE_ACCOUNT_EMAIL;
let key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || envMap.GOOGLE_SERVICE_ACCOUNT_KEY;
if (key) key = key.replace(/\\n/g, '\n');
const sheetId = process.env.GOOGLE_SHEET_ID || envMap.GOOGLE_SHEET_ID;

const serviceAccountAuth = new JWT({
    email: email,
    key: key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function run() {
    const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
    await doc.loadInfo();
    console.log("Sheet Titles:");
    for (let i = 0; i < doc.sheetCount; i++) {
        const sheet = doc.sheetsByIndex[i];
        console.log(`[${i}] "${sheet.title}" - Rows: ${sheet.rowCount}`);
        if (sheet.title.toLowerCase().includes('beauty') || sheet.title.toLowerCase().includes('new in')) {
            await sheet.loadHeaderRow();
            console.log(`Headers for ${sheet.title}:`, sheet.headerValues);
            const rows = await sheet.getRows({ offset: 0, limit: 5 });
            console.log(`First 5 rows for ${sheet.title}:`);
            rows.forEach((r, idx) => {
                console.log(`  Row ${idx+1}: Status: ${r.get('Status') || r.get('status') || r.get('dealtWith') || 'N/A'} | Date: ${r.get('date_found') || r.get('Date') || r.get('date') || 'N/A'}`);
            });
        }
    }
}

run().catch(console.error);
