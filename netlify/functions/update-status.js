import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from '../../lib/google-auth.js';

export const handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const body = JSON.parse(event.body);
        const { productUrl, status, workspace = 'beauty' } = body;

        if (!productUrl || !status) {
            return { statusCode: 400, body: JSON.stringify({ error: 'productUrl and status are required' }) };
        }

        const serviceAccountAuth = getGoogleAuth();
        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();

        const sheetTitle = workspace === 'grocery' ? 'Grocery' : 'New In';
        const sheet = doc.sheetsByTitle[sheetTitle];

        if (!sheet) {
            return { statusCode: 404, body: JSON.stringify({ error: `Sheet tab '${sheetTitle}' not found` }) };
        }

        const rows = await sheet.getRows();
        const row = rows.find(r => {
            const u = r.get('Product URL') || r.get('product url') || r.get('url');
            return u === productUrl;
        });

        if (!row) {
            return {
                statusCode: 200,
                body: JSON.stringify({ success: false, error: 'Product row not found in Sheet' })
            };
        }

        const statusHeader = ['Status', 'status'].find(h => row.get(h) !== undefined) || 'Status';
        row.set(statusHeader, status);
        await row.save();

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: true, productUrl, status, workspace })
        };

    } catch (error) {
        console.error('Error updating status:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal Server Error' })
        };
    }
};
