
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
dotenv.config();

async function testFilter() {
    try {
        const serviceAccountAuth = new JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY.replace(/\\n/g, '\n'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();

        console.log(`Document Title: ${doc.title}`);
        console.log(`Sheet Count: ${doc.sheetCount}`);

        doc.sheetsByIndex.forEach((s, i) => {
            console.log(`Sheet [${i}]: "${s.title}" (Rows: ${s.rowCount})`);
        });

        // Use index 0 as results.js does
        const sheet = doc.sheetsByIndex[0];
        console.log(`\nTesting Sheet: "${sheet.title}"`);

        console.log('--- Loading Header Row ---');
        await sheet.loadHeaderRow();
        const headers = sheet.headerValues;
        console.log('Headers found:', headers);

        // Dynamic Header Detection (Copied from results.js)
        const reviewsHeader = headers.find(h => ['reviews', 'review_count', 'Review Count', 'Reviews', 'rating_count'].includes(h)) || 'reviews';
        console.log(`Using Reviews Header: "${reviewsHeader}"`);

        const rows = await sheet.getRows();
        console.log(`Total rows: ${rows.length}`);

        // Simulate 0-5 filter
        const review_range = '0-5';
        console.log(`\nTesting filter: ${review_range}`);

        const filteredRows = rows.filter(row => {
            const val = row.get(reviewsHeader);
            const reviews = parseInt(val || '0', 10);
            const count = isNaN(reviews) ? 0 : reviews;

            return count >= 0 && count <= 5;
        });

        console.log(`Filtered rows count: ${filteredRows.length}`);

        // Check for the problem row (31 reviews)
        const problemRow = filteredRows.find(r => {
            const val = parseInt(r.get(reviewsHeader) || '0');
            return val > 5;
        });

        if (problemRow) {
            console.error('FAILED: Found row with > 5 reviews!');
            console.error(`Row details: ${problemRow.get('Product')} - ${problemRow.get(reviewsHeader)} reviews`);
        } else {
            console.log('SUCCESS: No rows with > 5 reviews found in filtered set.');
        }

    } catch (e) {
        console.error(e);
    }
}

testFilter();
