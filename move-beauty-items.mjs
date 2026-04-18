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

async function cleanAndMigrate() {
    const doc = new GoogleSpreadsheet(sheetId, auth);
    await doc.loadInfo();
    
    const beautySheet = doc.sheetsByTitle['Beauty'];
    const newInSheet = doc.sheetsByTitle['New In'];

    const beautyRetailers = ['sephora', 'holland', 'boots', 'superdrug'];

    if (beautySheet) {
        console.log('Cleaning retailers in Beauty tab...');
        await beautySheet.loadHeaderRow();
        const bRows = await beautySheet.getRows();
        let bFixed = 0;
        for (const row of bRows) {
            let ret = (row.get('retailer') || row.get('Retailer') || '').toString();
            if (ret.toLowerCase().includes('holland') && (ret.includes('Barret') && !ret.includes('Barrett'))) {
                console.log(`Fixing Beauty row: "${ret}" -> "Holland & Barrett"`);
                row.set('retailer', 'Holland & Barrett');
                await row.save();
                bFixed++;
            }
        }
        console.log(`Fixed ${bFixed} rows in Beauty tab.`);
    }

    if (newInSheet) {
        console.log('Checking for misplaced beauty items in New In tab...');
        await newInSheet.loadHeaderRow();
        const nRows = await newInSheet.getRows();
        
        const misplaced = nRows.filter(r => {
            const ret = (r.get('Retailer') || r.get('retailer') || '').toString().toLowerCase();
            return beautyKeywords.some(kw => ret.includes(kw));
        });

        if (misplaced.length > 0) {
            console.log(`Found ${misplaced.length} misplaced items in New In.`);
            const newRows = misplaced.map(r => {
                let ret = r.get('Retailer') || r.get('retailer');
                if (ret.toLowerCase().includes('holland')) ret = 'Holland & Barrett';
                if (ret.toLowerCase().includes('sephora')) ret = 'Sephora';
                
                return {
                    'date_found': r.get('Date Found') || r.get('date_found') || '',
                    'retailer': ret,
                    'manufacturer': r.get('Manufacturer') || r.get('manufacturer') || '',
                    'product': r.get('Product') || r.get('product') || '',
                    'brand': r.get('Brand') || r.get('brand') || '',
                    'price': r.get('Price') || r.get('price') || '',
                    'reviews': r.get('Review Count') || r.get('reviews') || 0,
                    'rating_value': r.get('Rating') || r.get('rating_value') || 0,
                    'product url': r.get('Product URL') || r.get('product url') || '',
                    'status': r.get('Status') || r.get('status') || 'Pending',
                    'run_id': r.get('Run ID') || r.get('run_id') || '',
                    'scrape_timestamp': r.get('Timestamp') || r.get('scrape_timestamp') || ''
                };
            });
            await beautySheet.addRows(newRows);
            console.log(`Moved ${newRows.length} items to Beauty tab.`);
        }
    }

    console.log('Cleanup finished!');
}

const beautyKeywords = ['sephora', 'holland', 'boots', 'superdrug'];
cleanAndMigrate().catch(console.error);
