import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from './lib/google-auth.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
dotenv.config();

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

async function checkSheet() {
    try {
        const serviceAccountAuth = getGoogleAuth();
        const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();
        console.log(`Document loaded: ${doc.title}`);
        console.log(`Available Sheets: ${Object.keys(doc.sheetsByTitle).join(', ')}`);
    } catch (err) {
        console.error("Error accessing sheet:", err.message);
    }
}
checkSheet();
