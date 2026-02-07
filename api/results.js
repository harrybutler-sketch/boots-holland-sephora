import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

export default async function handler(request, response) {
    if (request.method !== 'GET') {
        return response.status(405).send('Method Not Allowed');
    }

    // Disable caching to ensure fresh results
    response.setHeader('Cache-Control', 'no-store, max-age=0');

    try {
        const { limit = 200, retailer, days, q } = request.query;

        // Google Sheets Auth
        const serviceAccountAuth = new JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY.replace(/\\n/g, '\n'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];

        // Fetch rows
        const rows = await sheet.getRows();

        // Filter Logic
        let filteredRows = rows;

        // 1. Retailer Filter
        if (retailer && retailer !== 'All') {
            filteredRows = filteredRows.filter(row => row.get('retailer') === retailer);
        }

        // 2. Days Filter (Last X Days)
        if (days) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
            filteredRows = filteredRows.filter(row => {
                const dateVal = row.get('date_found');
                if (!dateVal) return true; // Keep rows with no date (legacy/missing header)
                const rowDate = new Date(dateVal);
                return rowDate >= cutoffDate;
            });
        }

        // 3. Search Query (Product Name or Brand)
        if (q) {
            const searchLower = q.toLowerCase();
            filteredRows = filteredRows.filter(row => {
                const name = (row.get('product') || row.get('product_name') || '').toLowerCase();
                const brand = (row.get('brand') || '').toLowerCase();
                return name.includes(searchLower) || brand.includes(searchLower);
            });
        }

        // Sort by date_found descending (newest first)
        filteredRows.sort((a, b) => {
            const dateA = a.get('date_found');
            const dateB = b.get('date_found');
            if (dateA < dateB) return 1;
            if (dateA > dateB) return -1;
            return 0;
        });

        // Apply Limit
        const validLimit = parseInt(limit);
        const slicedRows = filteredRows.slice(0, validLimit);

        // Map to JSON
        const results = slicedRows.map(row => ({
            date_found: row.get('date_found'),
            retailer: row.get('retailer'),
            product_name: row.get('product') || row.get('product_name'), // Fallback for old rows
            brand: row.get('brand'),
            category: row.get('category'),
            product_url: row.get('product url') || row.get('product_url'), // Fallback for old rows
            price_display: row.get('price') || row.get('price_display'), // Fallback
            reviews: row.get('reviews') || row.get('rating_count'), // Fallback
            rating: row.get('rating_value'),
            status: 'Active' // Placeholder or derived
        }));

        return response.status(200).json(results);

    } catch (error) {
        console.error('Error fetching results:', error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
}
