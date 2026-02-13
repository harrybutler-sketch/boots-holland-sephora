import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from './lib/google-auth.js';
import dotenv from 'dotenv';
dotenv.config();

async function debugHeaders() {
    try {
        const auth = getGoogleAuth();
        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
        console.log(`Loading doc ID: ${process.env.GOOGLE_SHEET_ID}`);
        await doc.loadInfo();
        console.log(`Doc Title: ${doc.title}`);

        const sheet = doc.sheetsByTitle['New In'];
        if (!sheet) {
            console.log("Sheet 'New In' not found!");
            console.log("Available sheets:", doc.sheetsByIndex.map(s => s.title).join(', '));
            return;
        }

        await sheet.loadHeaderRow();
        console.log(`\n--- Sheet: New In ---`);
        console.log(`Header Values (Raw):`, JSON.stringify(sheet.headerValues, null, 2));

        // Also check first few rows to see what keys they effectively have
        const rows = await sheet.getRows({ limit: 3 });
        if (rows.length > 0) {
            console.log(`\nRow 1 Raw Data:`, JSON.stringify(rows[0].toObject(), null, 2));
        } else {
            console.log("Sheet is empty.");
        }

    } catch (e) {
        console.error(e);
    }
}

debugHeaders();
