import { ApifyClient } from 'apify-client';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from '../lib/google-auth.js';

export default async function handler(request, response) {
    // Allow GET (for dashboard polling) and POST (for Apify webhooks)
    if (request.method !== 'GET' && request.method !== 'POST') {
        return response.status(405).send('Method Not Allowed');
    }

    let { runId, workspace = 'beauty' } = request.query;

    // Handle Apify Webhook (POST)
    if (request.method === 'POST') {
        try {
            const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
            // Apify sends runId in eventData.actorRunId
            if (body && body.eventData && body.eventData.actorRunId) {
                runId = body.eventData.actorRunId;
            }
        } catch (e) {
            console.error('Failed to parse webhook body:', e);
        }
    }

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
                headerValues: ['Date Found', 'Retailer', 'Manufacturer', 'Product', 'Brand', 'Price', 'Review Count', 'Rating', 'Product URL', 'Status', 'Run ID', 'Timestamp', 'Category']
            });
        }

        // Fetch existing rows for deduplication
        const rows = await sheet.getRows();
        // FIXED: Try multiple possible header names for robustness
        // FIXED: Use Map for updates
        const existingRowsMap = new Map();
        rows.forEach(row => {
            const u = row.get('Product URL') || row.get('product url') || row.get('url');
            if (u) existingRowsMap.set(u, row);
        });

        let appendedCount = 0;
        let updatedCount = 0;
        let duplicateCount = 0;
        const newRows = [];

        // Ensure Manufacturer column exists
        if (!sheet.headerValues.includes('Manufacturer') && !sheet.headerValues.includes('manufacturer')) {
            console.log('Adding Manufacturer column to sheet...');
            await sheet.setHeaderRow([...sheet.headerValues, 'Manufacturer']);
        }

        // Ensure Image URL column exists
        if (!sheet.headerValues.includes('Image URL') && !sheet.headerValues.includes('image_url')) {
            console.log('Adding Image URL column to sheet...');
            await sheet.setHeaderRow([...sheet.headerValues, 'Image URL']);
        }

        const processedUrls = new Set();

        for (const item of items) {
            const url = item.url || item.productUrl || item.product_url || item.canonicalUrl;

            if (!url) {
                console.log('Skipping item with no URL:', JSON.stringify(item));
                continue;
            }

            // Deduplicate within the current batch
            if (processedUrls.has(url)) {
                duplicateCount++;
                continue;
            }
            processedUrls.add(url);

            if (existingRowsMap.has(url)) {
                // UPDATE EXISTING ROW
                const row = existingRowsMap.get(url);
                let updated = false;

                const newReviews = parseInt(item.reviews || item.ratingCount || item.rating_count || item.reviewCount || item.reviewsCount || item.reviews_count || item.rating_count || 0);
                const newRating = item.rating || item.rating_value || item.ratingValue || 0;

                // Dynamic Header Lookup
                const reviewsHeader = ['Review Count', 'review_count', 'reviews', 'Reviews'].find(h => row.get(h) !== undefined) || 'Review Count';
                const ratingHeader = ['Rating', 'rating', 'stars', 'rating_value'].find(h => row.get(h) !== undefined) || 'Rating';
                const statusHeader = ['Status', 'status'].find(h => row.get(h) !== undefined) || 'Status';
                const lastUpdatedHeader = ['Last Updated', 'last_updated', 'Timestamp', 'timestamp'].find(h => row.get(h) !== undefined) || 'Last Updated';

                // Only update if we have meaningful data
                if (newReviews > 0 || newRating > 0) {
                    // Check if value actually changed to avoid API calls
                    // coerce to string for comparison as sheet values are strings
                    const currentReviews = parseInt(row.get(reviewsHeader) || '0');
                    const currentRating = parseFloat(row.get(ratingHeader) || '0');

                    if (currentReviews != newReviews || currentRating != newRating) {
                        console.log(`DEBUG: Updating ${url}`);
                        console.log(`   - Reviews: ${currentReviews} -> ${newReviews} (Header: ${reviewsHeader})`);
                        console.log(`   - Rating: ${currentRating} -> ${newRating} (Header: ${ratingHeader})`);

                        row.set(reviewsHeader, newReviews);
                        row.set(ratingHeader, newRating);
                        row.set(statusHeader, 'Enriched');
                        if (row.get(lastUpdatedHeader) !== undefined) {
                            row.set(lastUpdatedHeader, new Date().toISOString());
                        }
                        await row.save(); // Save per row
                        updated = true;
                        updatedCount++;
                        console.log(`Updated row for ${url} with ${newReviews} reviews (Header: ${reviewsHeader})`);
                    }
                }

                if (!updated) duplicateCount++;
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
                else if (lowerUrl.includes('superdrug.com')) retailer = 'Superdrug';
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

            // FILTER: Review Count (0-5 focus)
            // Defensive extraction: catch all common Apify field names
            const reviewCount = parseInt(
                item.reviews ||
                item.ratingCount ||
                item.rating_count ||
                item.reviewCount ||
                item.reviewsCount ||
                item.reviews_count ||
                item.ratingsCount ||
                0
            );

            if (reviewCount > 5) {
                console.log(`Skipping high-review product (${reviewCount} reviews): ${name}`);
                continue;
            }

            // FILTER: exclude non-food items in Grocery workspace
            // Specifically targeting the "Kettle" (appliance) vs "Kettle Chips" issue
            const lowerName = name.toLowerCase();
            const lowerCategory = (item.category || '').toLowerCase();

            const bannedKeywords = ['toaster', 'blender', 'microwave', 'electrical', 'appliance', 'menswear', 'womenswear', 'clothing', 'television', 'laptop', 'vacuum', 'iron', 'kettle', 'fryer'];

            // Allow kettle chips/crisps
            const isFoodKettle = lowerName.includes('kettle') && (
                lowerName.includes('chips') ||
                lowerName.includes('crisps') ||
                lowerName.includes('popcorn') ||
                lowerName.includes('salt') ||
                lowerName.includes('seasoning') ||
                lowerName.includes('foods')
            );

            if (bannedKeywords.some(kw => lowerName.includes(kw)) && !isFoodKettle) {
                console.log(`Skipping non-food item (Banned Keyword): ${name}`);
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

                if (brandName.toLowerCase() === name.toLowerCase()) {
                    brandName = '';
                }

                if (brandName.toLowerCase() === 'boots logo' || brandName.toLowerCase() === 'boots' || brandName.toLowerCase() === 'diet' || brandName.toLowerCase().includes('marketplace')) {
                    brandName = '';
                }
            }

            // 2. Filter out ONLY true promotional text
            const promoPhrases = ['3 for 2', '2 for', '1/2 price', 'save ', 'buy one', 'get one', 'points', 'clubcard'];
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

            // 4. Final Fallback: Take first 1-2 words of name if they look like a brand
            if (!brandName && name) {
                const words = name.split(' ').filter(w => w.trim());
                if (words.length > 0) {
                    const firstOne = words[0];
                    const secondOne = words[1] || '';
                    const firstTwo = words.slice(0, 2).join(' ');

                    const retailerKeywords = ['Tesco', 'Sainsbury', 'Asda', 'Morrisons', 'Waitrose', 'Ocado', 'M&S', 'Marks', 'Superdrug', 'Boots', 'Sephora'];
                    const isRetailerName = retailerKeywords.some(kw => firstOne.toLowerCase().includes(kw.toLowerCase()));

                    if (isRetailerName) {
                        brandName = firstTwo.includes('Finest') || firstTwo.includes('Organic') || firstTwo.includes('Best') || firstTwo.includes('Collection') ? firstTwo : firstOne;
                    } else if (/^[A-Z]/.test(firstOne)) {
                        // STRICTER: Check if the second word is also potentially part of a brand (Proper Noun check)
                        // If second word is capitalized and isn't a common lowercase-only connector or filler
                        const fillers = ['And', 'With', 'The', 'In', 'For', 'Of', 'At', 'By'];
                        if (secondOne && /^[A-Z]/.test(secondOne) && !fillers.includes(secondOne)) {
                            brandName = firstTwo;
                        } else {
                            const winePrefixes = ['Greasy', 'Oyster', 'Yellow', 'Red', 'Blue', 'Black', 'White', 'Silver', 'Gold', 'Wolf', 'Dark', 'Mud', 'Barefoot', 'Echo', 'Jam', 'Meat', 'Trivento', 'Casillero', 'Campo', 'Villa', 'Santa', 'Saint', 'St', 'Le', 'La', 'Les', 'El', 'Los', 'The', 'I'];
                            if (winePrefixes.includes(firstOne) || /^\d+$/.test(firstOne) || firstOne === 'Diet') {
                                brandName = firstTwo;
                            } else {
                                brandName = firstOne;
                            }
                        }
                    }
                }
            }

            let manufacturer = brandName ||
                (typeof item.manufacturer === 'string' ? item.manufacturer : (item.manufacturer && item.manufacturer.name)) ||
                item.vendor ||
                item.merchant ||
                '';

            if (manufacturer) {
                manufacturer = manufacturer
                    .replace(/\s+(Ltd|Limited|Corp|Corporation|Inc|PLC)$/i, '')
                    .replace(/\.$/, '')
                    .trim();
            }

            // FILTER: Skip own brands
            const ownBrandMap = {
                'Sephora': ['sephora', 'sephora collection'],
                'Holland & Barrett': ['holland', 'barrett', 'h&b', 'holland & barrett', 'holland and barrett'],
                'Sainsburys': ['sainsbury', 'hubbard', 'by sainsbury', 'sainsbury\'s', 'stamford street', 'be good to yourself', 'so organic', 'taste the difference'],
                'Tesco': ['tesco', 'stockwell', 'ms molly', 'eastman', 'finest', 'creamfields', 'grower\'s harvest', 'hearty food co', 'romano', 'willow farm', 'redmere', 'nightingale', 'boswell', 'bay fishmongers', 'woodside farms'],
                'Asda': ['asda', 'extra special', 'just essentials', 'asda logo', 'george home', 'smart price', 'farm stores'],
                'Morrisons': ['morrison', 'the best', 'savers', 'morrisons', 'nutmeg', 'market street', 'v taste'],
                'Ocado': ['ocado', 'ocado own range', 'm&s', 'marks & spencer'],
                'Waitrose': ['waitrose', 'essential waitrose', 'no.1', 'duchy organic', 'waitrose & partners', 'lovifeel', 'heston', 'duchy'],
                'Superdrug': ['superdrug', 'b.', 'b. by superdrug', 'studio', 'solait', 'me+', 'optimum', 'artisan']
            };

            const lowercaseManufacturer = (manufacturer || '').toLowerCase();
            const lowercaseBrand = (brandName || '').toLowerCase();
            const lowercaseName = name.toLowerCase();
            const ownBrandKeywords = ownBrandMap[retailer] || [];

            const isOwnBrand = ownBrandKeywords.some(kw => {
                const match = lowercaseManufacturer.includes(kw) ||
                    lowercaseBrand.includes(kw) ||
                    (lowercaseName.includes(kw) && !isFoodKettle);

                // Extra safety: Waitrose specific substring match for name
                if (retailer === 'Waitrose' && lowercaseName.includes('waitrose')) return true;

                return match || (lowercaseBrand === retailer.toLowerCase());
            });


            if (isOwnBrand) {
                console.log(`Skipping own-brand: ${name} (Matched: ${manufacturer || brandName})`);
                continue;
            }

            const imageUrl = item.image || item.imageUrl || item.productImage || item.image_url || item.thumbnailUrl || (item.images && item.images[0]) || '';

            newRows.push({
                'product': name,
                'retailer': retailer,
                'product url': url,
                'price': item.price_display || (item.price ? `${item.currency || 'GBP'} ${item.price}` : 'N/A'),
                'reviews': reviewCount,
                'date_found': new Date().toISOString().split('T')[0],
                'brand': brandName,
                'manufacturer': manufacturer,
                'category': item.category || 'New In',
                'rating_value': item.rating || item.rating_value || item.ratingValue || 0,
                'status': item.status || 'Enriched',
                'run_id': runId,
                'scrape_timestamp': new Date().toISOString(),
                'image_url': imageUrl
            });

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
