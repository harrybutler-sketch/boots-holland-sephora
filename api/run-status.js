import { ApifyClient } from 'apify-client';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from '../lib/google-auth.js';

export default async function handler(request, response) {
    if (request.method !== 'GET') {
        return response.status(405).send('Method Not Allowed');
    }

    const { runId, workspace = 'beauty' } = request.query;
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

        // Select tab based on workspace
        const sheetTitle = workspace === 'grocery' ? 'Grocery' : 'New In';
        let sheet = doc.sheetsByTitle[sheetTitle];

        if (!sheet) {
            console.log(`Creating new sheet tab: ${sheetTitle}`);
            sheet = await doc.addSheet({
                title: sheetTitle,
                headerValues: ['date_found', 'retailer', 'manufacturer', 'product', 'brand', 'price', 'reviews', 'rating_value', 'product url', 'status', 'run_id', 'scrape_timestamp', 'category']
            });
        }

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
                const lowerUrl = url.toLowerCase();
                if (lowerUrl.includes('sephora.co.uk')) retailer = 'Sephora';
                else if (lowerUrl.includes('boots.com')) retailer = 'Boots';
                else if (lowerUrl.includes('hollandandbarrett.com')) retailer = 'Holland & Barrett';
                else if (lowerUrl.includes('sainsburys.co.uk')) retailer = 'Sainsburys';
                else if (lowerUrl.includes('tesco.com')) retailer = 'Tesco';
                else if (lowerUrl.includes('asda.com')) retailer = 'Asda';
                else if (lowerUrl.includes('morrisons.com')) retailer = 'Morrisons';
                else if (lowerUrl.includes('ocado.com')) retailer = 'Ocado';
                else if (lowerUrl.includes('waitrose.com')) retailer = 'Waitrose';
                else retailer = 'Unknown';
            }

            const name = item.title || item.name || item.productName || item.product_name || '';

            // FILTER: Skip generic "Choose a shade" listings
            if (name.toLowerCase().includes('choose a shade')) {
                console.log(`Skipping generic variation listing: ${name}`);
                continue;
            }

            if (!name) {
                console.log('Skipping item with no product name:', JSON.stringify(item));
                continue;
            }

            // ROBUST BRAND MAPPING
            const rawBrand = item.brand || item.brandName || (item.attributes && item.attributes.brand) || '';
            let brandName = (typeof rawBrand === 'string' ? rawBrand : (rawBrand && (rawBrand.name || rawBrand.title || rawBrand.slogan || rawBrand.label))) || '';

            // 1. Clean up "Shop all" prefix and corporate suffixes
            if (brandName) {
                brandName = brandName
                    .replace(/^Shop all\s+/i, '')
                    .replace(/\s+(Ltd|Limited|Corp|Corporation|Inc|PLC)$/i, '')
                    .replace(/\.$/, '')
                    .trim();

                // If brand name is the same as the product name (common scraper error), clear it
                if (brandName.toLowerCase() === name.toLowerCase()) {
                    brandName = '';
                }
            }

            // 2. Filter out ONLY true promotional text
            const promoPhrases = ['3 for 2', '2 for', '1/2 price', 'save ', 'buy one', 'get one', 'points'];
            const isPromo = brandName && promoPhrases.some(p => brandName.toLowerCase().includes(p));

            if (isPromo) {
                console.log(`Ignoring promo brand: ${brandName}`);
                brandName = '';
            }

            // 3. Fallback: Search description if brand is missing or was a promo
            if (!brandName && item.description) {
                if (item.description.includes('7th Heaven')) {
                    brandName = '7th Heaven';
                } else {
                    const descMatch = item.description.match(/(?:By|Manufacturer|Brand):\s*([A-Z][a-zA-Z0-9&\s]+?)(?:\.|\n|,|$)/i);
                    if (descMatch) brandName = descMatch[1].trim();
                }
            }

            // 4. Final Fallback for Grocery: Take first 1-2 words of name if they look like a brand
            if (!brandName && name) {
                const words = name.split(' ');
                if (words.length > 0) {
                    const firstOne = words[0];
                    const firstTwo = words.slice(0, 2).join(' ');

                    const retailerKeywords = ['Tesco', 'Sainsbury', 'Asda', 'Morrisons', 'Waitrose', 'Ocado', 'M&S', 'Marks'];
                    const isRetailerName = retailerKeywords.some(kw => firstOne.toLowerCase().includes(kw.toLowerCase()));

                    if (isRetailerName) {
                        // It's likely an own-brand, extract it so it can be filtered/labeled correctly
                        brandName = firstTwo.includes('Finest') || firstTwo.includes('Organic') || firstTwo.includes('Best') ? firstTwo : firstOne;
                    } else if (words.length > 1 && /^[A-Z]/.test(firstOne)) {
                        // Heuristic: First word capitalized is often the brand
                        brandName = firstOne;
                    }
                }
            }

            let manufacturer = brandName ||
                (typeof item.manufacturer === 'string' ? item.manufacturer : (item.manufacturer && item.manufacturer.name)) ||
                item.vendor ||
                item.merchant ||
                '';

            // Clean manufacturer too
            if (manufacturer) {
                manufacturer = manufacturer
                    .replace(/\s+(Ltd|Limited|Corp|Corporation|Inc|PLC)$/i, '')
                    .replace(/\.$/, '')
                    .trim();

                if (manufacturer.toLowerCase() === name.toLowerCase()) {
                    manufacturer = '';
                }
            }

            // FILTER: Skip own brands
            const ownBrandMap = {
                'Sephora': ['sephora'],
                'Holland & Barrett': ['holland', 'barrett', 'h&b'],
                'Sainsburys': ['sainsbury', 'hubbard', 'by sainsbury'],
                'Tesco': ['tesco', 'stockwell', 'ms molly', 'eastman', 'finest'],
                'Asda': ['asda', 'extra special', 'just essentials'],
                'Morrisons': ['morrison', 'the best', 'savers'],
                'Ocado': ['ocado'],
                'Waitrose': ['waitrose', 'essential waitrose', 'no.1']
            };

            const lowercaseManufacturer = (manufacturer || '').toLowerCase();
            const lowercaseName = name.toLowerCase();
            const ownBrandKeywords = ownBrandMap[retailer] || [];

            const isOwnBrand = ownBrandKeywords.some(kw =>
                lowercaseManufacturer.includes(kw) ||
                (lowercaseManufacturer === '' && lowercaseName.startsWith(kw))
            );

            if (isOwnBrand) {
                console.log(`Skipping own-brand: ${name} (${manufacturer || 'Unknown Brand'})`);
                continue;
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
                'manufacturer': manufacturer,
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
