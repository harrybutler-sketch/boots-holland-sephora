require('dotenv').config();
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

async function testSheet() {
    try {
        console.log('Testing Sheet Connection...');
        console.log('Sheet ID:', process.env.GOOGLE_SHEET_ID);
        console.log('Service Email:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);

        if (!process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
            throw new Error('Missing environment variables. Check .env');
        }

        const serviceAccountAuth = new JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY.replace(/\\n/g, '\n'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();
        console.log('✅ Connected to Spreadsheet:', doc.title);

        const sheet = doc.sheetsByIndex[0];
        await sheet.loadHeaderRow();
        console.log('✅ Found Sheet:', sheet.title);
        console.log('ℹ️ Header Row:', sheet.headerValues);

        console.log('Attempting to add a test row...');
        await sheet.addRow({
            'product': 'Test Product ' + new Date().toLocaleTimeString(),
            'retailer': 'Test Debugger',
            'product url': 'https://example.com',
            'price': '£0.00',
            'reviews': '0'
        });
        console.log('✅ Test row added successfully!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response Data:', error.response.data);
        }
    }
}

testSheet();
