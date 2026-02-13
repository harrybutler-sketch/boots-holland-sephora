import { ApifyClient } from 'apify-client';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
dotenv.config();

console.log('Modules imported successfully.');

const runId = 'q4nV7RjJzdKk2xKOo';

async function syncToSheet() {
    try {
        console.log(`Syncing Run ID: ${runId}`);
        const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

        console.log('Fetching items...');
        const run = await client.run(runId).get();
        if (!run) throw new Error('Run not found');

        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        console.log(`Fetched ${items.length} items.`);

        if (items.length === 0) return;

        console.log('Connecting to Google Sheets...');
        const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        let key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

        if (!email || !key) throw new Error('Missing Google Credentials in .env');

        // Key cleanup
        if (key.startsWith('"') && key.endsWith('"')) key = key.slice(1, -1);
        key = key.replace(/\\n/g, '\n');

        const jwt = new JWT({
            email,
            key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, jwt);
        await doc.loadInfo();

        const sheet = doc.sheetsByTitle['New In'];
        if (!sheet) throw new Error('Sheet "New In" not found');

        const rows = await sheet.getRows();
        const existingUrls = new Set(rows.map(r => r.get('product url')));

        const newRows = [];
        let duplicateCount = 0;

        for (const item of items) {
            const url = item.url || (item.userData && item.userData.url);
            // FORCE SYNC: Ignored duplicate check to re-add fixed rows
            // if (!url || existingUrls.has(url)) {
            //     duplicateCount++;
            //     continue;
            // }

            // MAPPING
            const userData = item.userData || {};

            const manufacturer = item.manufacturer || '';
            const manufacturerStr = typeof manufacturer === 'object' ? (manufacturer.name || manufacturer.slogan || JSON.stringify(manufacturer)) : manufacturer;

            const brand = item.brand || '';
            const brandStr = typeof brand === 'object' ? (brand.name || brand.slogan || JSON.stringify(brand)) : brand;

            newRows.push({
                'date_found': new Date().toISOString().split('T')[0],
                'retailer': item.retailer || userData.retailer || 'Sephora',
                'manufacturer': manufacturerStr, // Users often mean "Brand" when they say "Manufacturer", but let's sync both cleanly
                'product': item.title || item.name || userData.title || '',
                'brand': brandStr,
                'price': item.price || userData.price || '',
                'reviews': item.reviews || userData.reviews || 0,
                'rating_value': item.rating || userData.rating || '',
                'product url': url,
                'status': 'Pending',
                'run_id': runId,
                'scrape_timestamp': new Date().toISOString(),
                'image_url': item.image || userData.image || ''
            });
            existingUrls.add(url);
        }

        console.log(`Adding ${newRows.length} rows (${duplicateCount} duplicates)...`);

        if (newRows.length > 0) {
            await sheet.addRows(newRows);
            console.log('SUCCESS: Rows added.');
        } else {
            console.log('No new rows to add.');
        }

    } catch (error) {
        console.error('FATAL ERROR:', error);
    }
}

syncToSheet();
