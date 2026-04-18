import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

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

const auth = new JWT({
    email: email,
    key: key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function dump() {
    const doc = new GoogleSpreadsheet(sheetId, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle["News"];
    await sheet.loadHeaderRow();
    
    console.log('Headers:', JSON.stringify(sheet.headerValues));
    const rows = await sheet.getRows();
    console.log('Row count:', rows.length);
    if (rows.length > 0) {
        console.log('Row[0] details:');
        sheet.headerValues.forEach(h => {
           console.log(`  ${h}: "${rows[0].get(h)}"`);
        });
    }
}

dump().catch(console.error);
