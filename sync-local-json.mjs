import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from './lib/google-auth.js';
import fs from 'fs';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const ZOHO_WEBHOOK_URL = process.env.ZOHO_FLOW_WEBHOOK_URL;

async function syncLocalJson() {
    try {
        console.log('=== Manual Sync: Local JSON to Google Sheets ===');
        
        const data = JSON.parse(fs.readFileSync('./tesco_manual_48.json', 'utf8'));
        console.log(`Loaded ${data.length} items from tesco_manual_48.json`);

        const serviceAccountAuth = getGoogleAuth();
        const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();

        const sheet = doc.sheetsByTitle['Grocery'];
        if (!sheet) {
            console.error('Sheet "Grocery" not found!');
            return;
        }

        const rows = await sheet.getRows();
        const existingUrls = new Set(rows.map(r => r.get('product url') || r.get('Product URL')).filter(Boolean));
        
        const newRows = [];
        let duplicateCount = 0;

        for (const item of data) {
            const url = item.URL || item.url;
            if (existingUrls.has(url)) {
                duplicateCount++;
                continue;
            }

            // Simple Brand Extraction
            const name = item.Name || item.name || '';
            const brandMatch = name.split(' ')[0];
            const brand = brandMatch.replace(/[^a-zA-Z]/g, '');

            const rowData = {
                'date_found': new Date().toISOString().split('T')[0],
                'retailer': 'Tesco',
                'manufacturer': brand,
                'product': name,
                'brand': brand,
                'price': item.Price || item.price || 'N/A',
                'reviews': 0,
                'rating_value': 0,
                'product url': url,
                'status': 'New',
                'run_id': 'manual_human_scrape',
                'scrape_timestamp': new Date().toISOString(),
                'category': 'Treats & Snacks',
                'image_url': ''
            };

            newRows.push(rowData);
            existingUrls.add(url);
        }

        console.log(`Found ${newRows.length} new items (skipped ${duplicateCount} duplicates).`);

        if (newRows.length > 0) {
            console.log(`Adding ${newRows.length} rows to "Grocery" sheet...`);
            await sheet.addRows(newRows);
            console.log('✅ Sheet update complete!');

            if (ZOHO_WEBHOOK_URL) {
                console.log(`Pushing ${newRows.length} items to Zoho Flow...`);
                for (const row of newRows) {
                   try {
                        const response = await fetch(ZOHO_WEBHOOK_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                product: row.product,
                                manufacturer: row.manufacturer,
                                product_url: row['product url'],
                                retailer: row.retailer,
                                price: row.price,
                                scrape_timestamp: row.scrape_timestamp,
                                tag: "manual_sync"
                            })
                        });
                        console.log(`Zoho Flow [${row.product}]: ${response.status}`);
                        // Small delay to prevent Zoho rate limits
                        await new Promise(r => setTimeout(r, 2000));
                   } catch (e) {
                       console.error(`Zoho Error for ${row.product}:`, e.message);
                   }
                }
            }
        } else {
            console.log('No new items to add.');
        }

    } catch (e) {
        console.error('Sync Error:', e);
    }
}

syncLocalJson();
