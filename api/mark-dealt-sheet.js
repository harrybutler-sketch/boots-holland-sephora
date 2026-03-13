import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from '../lib/google-auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { id, type, dealtWith } = req.body;
        
        if (!id || type === undefined || dealtWith === undefined) {
            return res.status(400).json({ error: 'Missing required fields (id, type, dealtWith)' });
        }

        // 'type' here refers to which feed it came from: 'linkedin' or 'news'
        const sheetTitle = type === 'linkedin' ? 'LinkedIn' : 'News';

        const serviceAccountAuth = getGoogleAuth();
        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();

        const sheet = doc.sheetsByTitle[sheetTitle];
        if (!sheet) {
            return res.status(404).json({ error: `${sheetTitle} sheet not found` });
        }

        // We fetch all rows and find the matching one.
        // Google Sheets API v4 with google-spreadsheet handles this well for smaller datasets (~thousands)
        const rows = await sheet.getRows();
        
        // Let's assume the unique identifier passed matches the 'id' column we generate
        // Because the 'id' in our api/ results maps directly to `row.get('id')`
        const targetRow = rows.find(row => row.get('id') === id);

        if (!targetRow) {
            return res.status(404).json({ error: `Item with id ${id} not found in sheet` });
        }

        // Update the dealtWith column (represented as a boolean string in Sheets usually)
        targetRow.set('dealtWith', dealtWith ? 'TRUE' : 'FALSE');
        await targetRow.save();

        return res.status(200).json({ success: true, message: 'Status updated successfully' });

    } catch (error) {
        console.error('Error updating dealtWith status:', error);
        return res.status(500).json({ error: error.message || 'Failed to update status' });
    }
}
