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
    const sheet = doc.sheetsByTitle["New In"];
    await sheet.loadHeaderRow();
    
    const rows = await sheet.getRows();
    let validCount = 0;
    
    rows.forEach((r) => {
        const d = r.get('date_found') || r.get('Date') || r.get('date');
        const st = r.get('Status') || r.get('status') || r.get('dealtWith');
        const isDealtWith = st === 'TRUE' || st === 'Dealt With' || st === 'Done' || st === 'Finished';
        
        if (d && new Date(d).getTime() > new Date('2026-03-15').getTime()) {
            if (!isDealtWith) {
                validCount++;
            }
        }
    });
    
    console.log(`Undealt items in last 28 days for Beauty: ${validCount}`);
}

run().catch(console.error);
