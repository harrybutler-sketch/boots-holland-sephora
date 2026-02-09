import { ApifyClient } from 'apify-client';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from '../lib/google-auth.js';

export default async function handler(request, response) {
    if (request.method !== 'GET') {
        return response.status(405).send('Method Not Allowed');
    }

    const { runId } = request.query;
    if (!runId) {
        return response.status(400).json({ error: 'runId is required' });
    }

    const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

    try {
        const run = await client.run(runId).get();

        if (!run) {
            return response.status(404).json({ error: 'Run not found' });
        }

        if (run.status !== 'SUCCEEDED') {
            return response.status(200).json({
                status: run.status,
                datasetId: run.defaultDatasetId,
            });
        }

        // Run succeeded, process data
        const dataset = await client.dataset(run.defaultDatasetId).listItems();
        const items = dataset.items;

        console.log(`Fetched ${items.length} items from Apify dataset.`);
        if (items.length > 0) {
            console.log('First item structure:', JSON.stringify(items[0], null, 2));
        }

        // Google Sheets Auth
        const serviceAccountAuth = getGoogleAuth();

        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];

        // Fetch existing rows for deduplication
        const rows = await sheet.getRows();
        // FIXED: Use 'product url' (space) not 'product_url'
        const existingUrls = new Set(rows.map((row) => row.get('product url')));

        let appendedCount = 0;
        let duplicateCount = 0;
        const newRows = [];

        // Ensure Manufacturer column exists
        if (!sheet.headerValues.includes('manufacturer')) {
            console.log('Adding manufacturer column to sheet...');
            await sheet.setHeaderRow([...sheet.headerValues, 'manufacturer']);
        }

        for (const item of items) {
            const url = item.url || item.productUrl || item.product_url || item.canonicalUrl;

            if (!url) {
                console.log('Skipping item with no URL:', JSON.stringify(item));
                continue;
            }

            if (existingUrls.has(url)) {
                duplicateCount++;
                continue;
            }

            const price = item.price || item.price_value || (item.offers && item.offers.price) || 0;
            const currency = item.currency || item.price_currency || (item.offers && item.offers.priceCurrency) || 'GBP';

            let retailer = item.retailer;
            if (!retailer && url) {
                if (url.includes('sephora.co.uk')) retailer = 'Sephora';
                else if (url.includes('boots.com')) retailer = 'Boots';
                else if (url.includes('hollandandbarrett.com')) retailer = 'Holland & Barrett';
                else retailer = 'Unknown';
            }

            const name = item.title || item.name || item.productName || item.product_name || '';

            if (!name) {
                console.log('Skipping item with no product name:', JSON.stringify(item));
                continue;
            }

            // ROBUST BRAND MAPPING
            const rawBrand = item.brand || item.brandName || item.manufacturer || item.vendor || item.merchant || (item.attributes && item.attributes.brand) || '';
            let brandName = (typeof rawBrand === 'string' ? rawBrand : (rawBrand && (rawBrand.name || rawBrand.title || rawBrand.slogan || rawBrand.label))) || '';

            // Filter out promotional text that sometimes ends up in the brand field
            const promoPhrases = ['3 for 2', '2 for', '1/2 price', 'save', 'buy one', 'get one', 'off', 'points', 'shop all', 'new in'];
            const isPromo = brandName && promoPhrases.some(p => brandName.toLowerCase().includes(p));

            if (isPromo) {
                console.log(`Ignoring promo brand: ${brandName}`);
                brandName = '';
            }

            // Clean up common "Shop all" prefix from H&B
            if (brandName) {
                brandName = brandName.replace(/^Shop all\s+/i, '').replace(/\.$/, '').trim();
            }

            // Fallback: If brand is still missing, try to find it in the description
            if (!brandName && item.description) {
                // Look for "By [Brand]" or similar patterns, or just a direct mention of "7th Heaven"
                if (item.description.includes('7th Heaven')) {
                    brandName = '7th Heaven';
                }
            }

            // ROBUST CATEGORY MAPPING
            const rawCategory = item.category || (item.categories && item.categories[0]) || (item.breadcrumbs && item.breadcrumbs.join(' > ')) || (item.breadcrumbs && item.breadcrumbs[0]) || item.section || '';
            const categoryName = (typeof rawCategory === 'string' ? rawCategory : (rawCategory && (rawCategory.name || rawCategory.title || rawCategory.label))) || '';

            // ROBUST REVIEWS/RATING MAPPING
            const reviewCount = item.reviewCount || item.reviewsCount || item.reviews_count || item.rating_count ||
                (item.reviews && (typeof item.reviews === 'number' ? item.reviews : (item.reviews.count || item.reviews.total || item.reviews.total_reviews))) ||
                (item.aggregateRating && item.aggregateRating.reviewCount) || 0;

            const ratingValue = item.rating || item.rating_value || item.ratingValue || item.stars || item.score ||
                (item.aggregateRating && item.aggregateRating.ratingValue) || '';

            newRows.push({
                'product': name,
                'retailer': retailer,
                'product url': url,
                'price': item.price_display || `${currency} ${price}`,
                'reviews': reviewCount,
                'date_found': new Date().toISOString().split('T')[0],
                'brand': brandName,
                'manufacturer': item.manufacturer || item.vendor || item.merchant || brandName || '',
                'category': categoryName,
                'rating_value': ratingValue,
                'status': 'Pending',
                'run_id': runId,
                'scrape_timestamp': new Date().toISOString(),
            });

            existingUrls.add(url);
        }

        // Batch write to avoid timeouts/limits
        if (newRows.length > 0) {
            const BATCH_SIZE = 50;
            for (let i = 0; i < newRows.length; i += BATCH_SIZE) {
                const chunk = newRows.slice(i, i + BATCH_SIZE);
                console.log(`Writing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(newRows.length / BATCH_SIZE)}...`);
                await sheet.addRows(chunk);
            }
            appendedCount = newRows.length;
        }

        return response.status(200).json({
            status: 'SUCCEEDED',
            datasetId: run.defaultDatasetId,
            itemCount: items.length,
            appendedCount,
            duplicateCount,
            lastUpdated: new Date().toISOString(),
        });

    } catch (error) {
        console.error('Error checking status:', error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
}
