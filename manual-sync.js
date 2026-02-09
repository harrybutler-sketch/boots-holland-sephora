
import { ApifyClient } from 'apify-client';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from './lib/google-auth.js';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

async function manualSync(runId) {
    try {
        console.log(`Syncing Run: ${runId}`);
        const dataset = await client.run(runId).dataset();
        const { items } = await dataset.listItems();
        console.log(`Found ${items.length} items in dataset.`);

        const auth = getGoogleAuth();
        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];

        const newRows = [];
        for (const item of items) {
            const name = item.title || item.name || item.productName || item.product_name || '';
            if (name.toLowerCase().includes('choose a shade')) continue;

            const rawBrand = item.brand || item.brandName || (item.attributes && item.attributes.brand) || '';
            let brandName = (typeof rawBrand === 'string' ? rawBrand : (rawBrand && (rawBrand.name || rawBrand.title || rawBrand.slogan || rawBrand.label))) || '';
            if (brandName) brandName = brandName.replace(/^Shop all\s+/i, '').replace(/\.$/, '').trim();

            const manufacturer = brandName || (typeof item.manufacturer === 'string' ? item.manufacturer : (item.manufacturer && item.manufacturer.name)) || item.vendor || item.merchant || '';
            const reviewCount = item.reviewCount || item.reviewsCount || item.reviews_count || item.rating_count || 0;
            const ratingValue = item.rating || item.rating_value || item.ratingValue || '';
            const price = item.offers?.price || item.price || '';

            newRows.push({
                'product': name,
                'retailer': item.url?.includes('sephora') ? 'Sephora' : 'Holland & Barrett',
                'product url': item.url || '',
                'price': price,
                'reviews': reviewCount,
                'date_found': new Date().toISOString().split('T')[0],
                'brand': brandName,
                'category': '',
                'rating_value': ratingValue,
                'run_id': runId,
                'scrape_timestamp': new Date().toISOString(),
                'manufacturer': manufacturer
            });
        }

        if (newRows.length > 0) {
            console.log(`Adding ${newRows.length} rows to sheet...`);
            await sheet.addRows(newRows);
            console.log('Sync complete!');
        } else {
            console.log('No valid rows found after filtering.');
        }

    } catch (e) {
        console.error('FAILED SYNC:', e);
    }
}

// Use the latest run ID from the previous check
manualSync('KmVbA0OVNR82JmYjg');
