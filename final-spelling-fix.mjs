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

async function finalCleanup() {
    const doc = new GoogleSpreadsheet(sheetId, auth);
    await doc.loadInfo();
    
    const beautySheet = doc.sheetsByTitle['Beauty'];
    if (!beautySheet) return;

    console.log('Fetching all rows from Beauty sheet...');
    const rows = await beautySheet.getRows();
    let fixedCount = 0;
    
    for (const row of rows) {
        let ret = (row.get('retailer') || row.get('Retailer') || '').toString();
        
        // Fix Holland & Barrett (one T problem)
        if (ret.toLowerCase().includes('holland') && ret.toLowerCase().includes('barret')) {
            if (ret !== 'Holland & Barrett') {
                row.set('retailer', 'Holland & Barrett');
                await row.save();
                fixedCount++;
            }
        }
        
        // Fix Sephora (Sephota problem)
        if (ret.toLowerCase().includes('sepho') && !ret.toLowerCase().includes('sephora')) {
            row.set('retailer', 'Sephora');
            await row.save();
            fixedCount++;
        }
    }
    
    console.log(`Successfully fixed ${fixedCount} rows.`);
}

finalCleanup().catch(console.error);
