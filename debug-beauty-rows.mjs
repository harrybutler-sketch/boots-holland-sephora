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

const serviceAccountAuth = new JWT({
    email: envMap.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: envMap.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function checkSheet() {
    const doc = new GoogleSpreadsheet(envMap.GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle['Beauty'] || doc.sheetsByTitle['New In'];
    console.log(`Checking sheet: ${sheet.title}`);
    const rows = await sheet.getRows();
    console.log(`Total rows: ${rows.length}`);
    
    console.log('\nLast 10 rows:');
    rows.slice(-10).forEach(r => {
        console.log(`- ${r.get('date_found')} | ${r.get('retailer')} | ${r.get('product_name')} | Status: ${r.get('status')}`);
    });
}

checkSheet();
