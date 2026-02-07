import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from '../lib/google-auth.js';

export default async function handler(request, response) {
    try {
        console.log('Testing Sheet Connection from Vercel...');

        // Check Env Vars
        const hasEmail = !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        const hasKey = !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
        const hasSheetId = !!process.env.GOOGLE_SHEET_ID;

        if (!hasEmail || !hasKey || !hasSheetId) {
            return response.status(500).json({
                error: 'Missing Environment Variables',
                details: { hasEmail, hasKey, hasSheetId }
            });
        }

        // Google Sheets Auth
        const serviceAccountAuth = getGoogleAuth();

        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        await sheet.loadHeaderRow();

        // Add Test Row
        const testRow = {
            'product': 'Vercel Test ' + new Date().toISOString(),
            'retailer': 'Debug Function',
            'product url': 'https://vercel-debug.com',
            'price': '0.00',
            'reviews': '1'
        };

        await sheet.addRow(testRow);

        return response.status(200).json({
            message: 'Successfully connected and added test row!',
            sheetTitle: doc.title,
            headerValues: sheet.headerValues,
            addedRow: testRow
        });

    } catch (error) {
        console.error('Test Connection Error:', error);
        return response.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
}
