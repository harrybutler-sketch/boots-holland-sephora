import 'dotenv/config';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// Logic copied from netlify/functions/results.js
async function testResultsLocally() {
    console.log('🚀 Testing Results logic locally...');

    try {
        const serviceAccountAuth = new JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY.replace(/\\n/g, '\n'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        console.log(`Sheet: ${sheet.title}`);

        const rows = await sheet.getRows();
        console.log(`Fetched ${rows.length} rows.`);

        if (rows.length > 0) {
            console.log('First row raw data (keys):', Object.keys(rows[0].toObject()));
            console.log('First row "product" value:', rows[0].get('product'));
            console.log('First row "retailer" value:', rows[0].get('retailer'));
        }

        // Simulate Filters
        let filteredRows = rows;
        const retailer = 'All'; // default
        const days = '28'; // default
        const q = ''; // default

        // Filter Logic (Same as results.js)
        if (days) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
            console.log(`Filtering for dates after: ${cutoffDate.toISOString()}`);

            filteredRows = filteredRows.filter(row => {
                const dateStr = row.get('date_found');
                if (!dateStr) return true; // Match API logic: keep missing dates
                const rowDate = new Date(dateStr);
                return rowDate >= cutoffDate;
            });
        }
        console.log(`Rows after Date filter: ${filteredRows.length}`);

        // Map to JSON (Same as results.js)
        const results = filteredRows.map(row => ({
            date_found: row.get('date_found'),
            retailer: row.get('retailer'),
            product_name: row.get('product') || row.get('product_name'), // Fallback for old rows
            brand: row.get('brand'),
            category: row.get('category'),
            product_url: row.get('product url') || row.get('product_url'), // Fallback for old rows
            price_display: row.get('price') || row.get('price_display'), // Fallback
            reviews: row.get('reviews') || row.get('rating_count'), // Fallback
            rating: row.get('rating_value'),
            status: 'Active'
        }));

        console.log(`Mapped ${results.length} results.`);
        if (results.length > 0) {
            console.log('First result:', JSON.stringify(results[0], null, 2));
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testResultsLocally();
