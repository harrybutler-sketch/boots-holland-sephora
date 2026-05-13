import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from '../lib/google-auth.js';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).send('Method Not Allowed');
    }

    try {
        const { productUrl, status, workspace = 'beauty' } = request.body;

        if (!productUrl || !status) {
            return response.status(400).json({ error: 'productUrl and status are required' });
        }

        const serviceAccountAuth = getGoogleAuth();
        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();

        let sheetTitle = 'New In';
        if (workspace === 'grocery') {
            sheetTitle = 'Grocery';
        } else if (workspace === 'linkedin' || workspace === 'news') {
            sheetTitle = 'LinkedIn';
        } else if (workspace === 'beauty') {
            sheetTitle = 'Beauty';
        } else if (workspace === 'lifestyle') {
            sheetTitle = 'Lifestyle';
        }

        const sheet = doc.sheetsByTitle[sheetTitle] || doc.sheetsByTitle['New In'];

        if (!sheet) {
            return response.status(404).json({ error: `Sheet tab '${sheetTitle}' not found` });
        }

        const rows = await sheet.getRows();
        const row = rows.find(r => {
            const u = r.get('Product URL') || r.get('product url') || r.get('url') || r.get('post url') || r.get('Post URL');
            return u === productUrl;
        });

        if (!row) {
            return response.status(200).json({ success: false, error: 'Product row not found in Sheet' });
        }

        if (sheetTitle === 'LinkedIn') {
            row.set('dealtWith', status === 'Dealt With' ? 'TRUE' : 'FALSE');
        } else {
            const statusHeader = ['Status', 'status'].find(h => row.get(h) !== undefined) || 'Status';
            row.set(statusHeader, status);
        }
        await row.save();

        return response.status(200).json({ success: true, productUrl, status, workspace });

    } catch (error) {
        console.error('Error updating status:', error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
}
