import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from '../lib/google-auth.js';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).send('Method Not Allowed');
    }

    try {
        const { productUrl, status } = request.body;

        if (!productUrl || !status) {
            return response.status(400).json({ error: 'productUrl and status are required' });
        }

        const serviceAccountAuth = getGoogleAuth();
        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];

        const rows = await sheet.getRows();
        const row = rows.find(r => r.get('product url') === productUrl);

        if (!row) {
            return response.status(404).json({ error: 'Product row not found' });
        }

        row.set('status', status);
        await row.save();

        return response.status(200).json({ success: true, productUrl, status });

    } catch (error) {
        console.error('Error updating status:', error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
}
