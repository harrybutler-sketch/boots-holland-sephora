require('dotenv').config();
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

async function fixHeaders() {
    console.log('🔧 Fixing Sheet Headers...');

    const serviceAccountAuth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];

    await sheet.loadHeaderRow();
    const currentHeaders = sheet.headerValues;
    console.log('Current Headers:', currentHeaders);

    const requiredHeaders = [
        'product',
        'retailer',
        'product url',
        'price',
        'reviews',
        'date_found',
        'brand',
        'category',
        'rating_value',
        'run_id',
        'scrape_timestamp'
    ];

    // Check if we need to update
    const missing = requiredHeaders.filter(h => !currentHeaders.includes(h));

    if (missing.length === 0) {
        console.log('✅ All headers present. No action needed.');
        return;
    }

    console.log('⚠️ Missing headers:', missing);
    console.log('Updating header row...');

    // Set the new header row (preserves existing data, just updates row 1)
    // Union of current + missing to avoid losing anything custom
    const newHeaders = [...new Set([...currentHeaders, ...requiredHeaders])];

    await sheet.setHeaderRow(newHeaders);
    console.log('✅ Headers updated:', newHeaders);
}

fixHeaders();
