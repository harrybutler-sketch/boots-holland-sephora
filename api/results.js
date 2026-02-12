import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from '../lib/google-auth.js';

export default async function handler(request, response) {
    if (request.method !== 'GET') {
        return response.status(405).send('Method Not Allowed');
    }

    // Disable caching to ensure fresh results
    response.setHeader('Cache-Control', 'no-store, max-age=0');

    try {
        const { limit = 5000, retailer, days, q, workspace = 'beauty' } = request.query;

        // Google Sheets Auth
        const serviceAccountAuth = getGoogleAuth();

        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();

        const sheetTitle = workspace === 'grocery' ? 'Grocery' : 'New In';
        const sheet = doc.sheetsByTitle[sheetTitle];

        if (!sheet) {
            return response.status(200).json([]); // No data yet for this workspace
        }

        // Fetch rows
        const rows = await sheet.getRows();

        // Filter Logic
        let filteredRows = rows;

        // 1. Retailer Filter
        if (retailer && retailer !== 'All') {
            filteredRows = filteredRows.filter(row => {
                const rowRetailer = row.get('Retailer') || row.get('retailer');
                return rowRetailer === retailer;
            });
        }

        // 2. Days Filter (Last X Days)
        if (days) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
            filteredRows = filteredRows.filter(row => {
                const dateVal = row.get('Date Found') || row.get('date_found');
                if (!dateVal) return true;
                const rowDate = new Date(dateVal);
                return rowDate >= cutoffDate;
            });
        }

        // 3. Search Query (Product Name or Brand)
        if (q) {
            const searchLower = q.toLowerCase();
            filteredRows = filteredRows.filter(row => {
                const name = (row.get('Product') || row.get('product') || row.get('product_name') || '').toLowerCase();
                const brand = (row.get('Brand') || row.get('brand') || '').toLowerCase();
                return name.includes(searchLower) || brand.includes(searchLower);
            });
        }

        // 4. Require Product Name
        filteredRows = filteredRows.filter(row => {
            const name = row.get('Product') || row.get('product') || row.get('product_name');
            return name && name.trim().length > 0;
        });

        // Sort by Date Found descending
        filteredRows.sort((a, b) => {
            const dateA = a.get('Date Found') || a.get('date_found');
            const dateB = b.get('Date Found') || b.get('date_found');
            if (dateA < dateB) return 1;
            if (dateA > dateB) return -1;
            return 0;
        });

        // Apply Limit
        const validLimit = parseInt(limit);
        const slicedRows = filteredRows.slice(0, validLimit);

        // Map to JSON
        const results = slicedRows.map(row => {
            const data = row.toObject();

            const productName = data.Product || data.product || data.product_name || '';
            const brand = data.Brand || data.brand || '';
            const manufacturer = data.Manufacturer || data.manufacturer || brand || '';

            return {
                date_found: data['Date Found'] || data.date_found,
                retailer: data.Retailer || data.retailer,
                product_name: productName,
                brand: brand,
                manufacturer: manufacturer,
                category: data.Category || data.category,
                product_url: data['Product URL'] || data['product url'] || data.product_url || '',
                price_display: data.Price || data.price || data.price_display || '',
                reviews: data['Review Count'] || data.reviews || data.rating_count || 0,
                rating: data.Rating || data.rating_value,
                status: data.Status || data.status || 'Pending',
                image_url: data['Image URL'] || data.image_url || ''
            };
        });

        return response.status(200).json(results);

    } catch (error) {
        console.error('Error fetching results:', error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
}
