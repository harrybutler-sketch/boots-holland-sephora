import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from '../lib/google-auth.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const serviceAccountAuth = getGoogleAuth();
        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();

        const sheet = doc.sheetsByTitle['News'];
        if (!sheet) {
            return res.status(200).json([]);
        }

        const rows = await sheet.getRows();
        
        const mappedItems = rows.map((row, index) => {
            return {
                id: row.get('id') || `news-${index}`,
                source: row.get('source') || 'Unknown Source',
                headline: row.get('headline') || 'Unknown Headline',
                snippet: row.get('snippet') || '',
                articleUrl: row.get('article url') || '#',
                date: row.get('date') || 'Recent',
                brand: row.get('brand') || 'Unknown Brand',
                product: row.get('product') || 'Unknown Product',
                retailer: row.get('retailer') || 'Unknown',
                type: row.get('type') || 'other',
                dealtWith: row.get('dealtWith') === 'TRUE'
            };
        });

        return res.status(200).json(mappedItems);
    } catch (error) {
        console.error('Error fetching News results from Sheets:', error);
        return res.status(500).json({ error: error.message || 'Failed to fetch news results' });
    }
}
