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

                const newReviews = item.reviews || item.rating_count || item.reviewCount || 0;
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

            // FILTER: exclude non-food items in Grocery workspace
            // Specifically targeting the "Kettle" (appliance) vs "Kettle Chips" issue
            const lowerName = name.toLowerCase();
            const lowerCategory = (item.category || '').toLowerCase(); // Fallback if category extraction above isn't eager enough, but we should use the one we define later or just check raw item

            // Should properly extract category first if we want to use it, but `item.category` might exist from Apify
            // Let's rely on name mainly as it's most reliable

            const bannedKeywords = ['toaster', 'blender', 'microwave', 'electrical', 'appliance', 'menswear', 'womenswear', 'clothing'];

            // Smart "Kettle" check
            if (lowerName.includes('kettle') &&
                !lowerName.includes('chips') &&
                !lowerName.includes('crisps') &&
                !lowerName.includes('popcorn') &&
                !lowerName.includes('salt') &&
                !lowerName.includes('seasoning') &&
                !lowerName.includes('soup') && // Sometimes soups
                !lowerName.includes('vegetable') &&
                !lowerName.includes('foods')) {

                // If it's just "Kettle" or "Electric Kettle" or in a non-food category
                if (lowerName.includes('electric') || lowerName.includes('cordless') || lowerName.includes('jug') || lowerCategory.includes('appliance')) {
                    console.log(`Skipping non-food item (Kettle appliance): ${name}`);
                    continue;
                }

                // If the name is VERY short and just "Kettles" or similar, skip
                if (lowerName === 'kettle' || lowerName === 'kettles') {
                    console.log(`Skipping non-food item (Generic Kettle): ${name}`);
                    continue;
                }

                // If it's likely an appliance brand
                if (item.brand === 'Swan' || item.brand === 'Breville' || item.brand === 'Russell Hobbs') {
                    console.log(`Skipping non-food item (Appliance Brand): ${name}`);
                    continue;
                }
            }

            if (bannedKeywords.some(kw => lowerName.includes(kw))) {
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

                // FIX: Ignore "Boots Logo" or just "Boots" if it's not an own-brand item (own-brand logic handles the rest)
                // But specifically "Boots Logo" is an artifact of the scraper finding the site logo
                if (brandName.toLowerCase() === 'boots logo' || brandName.toLowerCase() === 'boots' || brandName.toLowerCase() === 'diet' || brandName.toLowerCase().includes('marketplace')) {
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

            // 4. Final Fallback: Take first 1-2 words of name if they look like a brand
            // Enabled for ALL workspaces now (was just Grocery)
            if (!brandName && name) {
                const words = name.split(' ');
                if (words.length > 0) {
                    const { firstOne, firstTwo } = { firstOne: words[0], firstTwo: words.slice(0, 2).join(' ') };

                    const retailerKeywords = ['Tesco', 'Sainsbury', 'Asda', 'Morrisons', 'Waitrose', 'Ocado', 'M&S', 'Marks'];
                    const isRetailerName = retailerKeywords.some(kw => firstOne.toLowerCase().includes(kw.toLowerCase()));

                    // FIX: Ignore common adjectives/sizes at start of name
                    const ignoreAdjectives = ['Giant', 'Mini', 'Large', 'Small', 'Medium', 'Multipack', 'Family', 'Love', 'Happy', 'New', 'The', 'A', 'An', 'My', 'Our', 'Your'];

                    let brandStartWords = words;
                    if (ignoreAdjectives.includes(firstOne) && words.length > 1) {
                        // Skip the first word if it's a generic adjective
                        brandStartWords = words.slice(1);
                        // Re-evaluate firstOne/firstTwo based on new start
                    }

                    const effectiveFirstOne = brandStartWords[0];
                    const effectiveFirstTwo = brandStartWords.slice(0, 2).join(' ');

                    if (isRetailerName) {
                        brandName = firstTwo.includes('Finest') || firstTwo.includes('Organic') || firstTwo.includes('Best') ? firstTwo : firstOne;
                    } else if (brandStartWords.length > 0 && /^[A-Z]/.test(effectiveFirstOne)) {

                        // FIX: Wine/Spirits Multi-word Brands
                        const winePrefixes = [
                            'Greasy', 'Oyster', 'Yellow', 'Red', 'Blue', 'Black', 'White', 'Silver', 'Gold',
                            'Wolf', 'Dark', 'Mud', 'Barefoot', 'Echo', 'Jam', 'Meat', 'Trivento', 'Casillero',
                            'Campo', 'Villa', 'Santa', 'Saint', 'St', 'Le', 'La', 'Les', 'El', 'Los', 'The',
                            'I' // "I Heart"
                        ];

                        // FIX: "19 Crimes" (starts with number)
                        const isNumberStart = /^\d+$/.test(effectiveFirstOne);

                        if (effectiveFirstOne === 'Diet') {
                            brandName = effectiveFirstTwo;
                        } else if (winePrefixes.includes(effectiveFirstOne) || isNumberStart) {
                            brandName = effectiveFirstTwo;
                        } else {
                            brandName = effectiveFirstOne;
                        }

                        // FIX: "Ink by Grant Burge" -> Extract "Grant Burge"
                        // This overrides the above if a 'by' pattern is found
                        if (name.includes(' by ')) {
                            const byMatch = name.match(/ by ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/);
                            if (byMatch && byMatch[1]) {
                                // Check if captured group is not a generic word like "The"
                                if (byMatch[1].length > 3) {
                                    brandName = byMatch[1];
                                }
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
                'Sephora': ['sephora', 'sephora collection'],
                'Holland & Barrett': ['holland', 'barrett', 'h&b', 'holland & barrett', 'holland and barrett'],
                'Sainsburys': ['sainsbury', 'hubbard', 'by sainsbury', 'sainsbury\'s', 'stamford street'],
                'Tesco': ['tesco', 'stockwell', 'ms molly', 'eastman', 'finest', 'creamfields', 'grower\'s harvest', 'hearty food co', 'romano', 'willow farm', 'redmere', 'nightingale', 'boswell'],
                'Asda': ['asda', 'extra special', 'just essentials', 'asda logo', 'george home'],
                'Morrisons': ['morrison', 'the best', 'savers', 'morrisons', 'nutmeg'],
                'Ocado': ['ocado', 'ocado own range', 'm&s', 'marks & spencer'], // Ocado sells M&S, which is arguably "own brand" in this context if they want brand allies
                'Waitrose': ['waitrose', 'essential waitrose', 'no.1', 'duchy organic', 'waitrose & partners']
            };

            const lowercaseManufacturer = (manufacturer || '').toLowerCase();
            const lowercaseBrand = (brandName || '').toLowerCase();
            const lowercaseName = name.toLowerCase();
            const ownBrandKeywords = ownBrandMap[retailer] || [];

            // Helper to check if a string contains any keyword
            const containsKeyword = (str) => ownBrandKeywords.some(kw => str.includes(kw));

            // Logic: 
            // 1. If Manufacturer/Brand contains retailer keyword -> Skip
            // 2. If Product Name STARTS with retailer keyword -> Skip
            // 3. If Brand is the same as Retailer Name -> Skip

            const isOwnBrand =
                containsKeyword(lowercaseManufacturer) ||
                containsKeyword(lowercaseBrand) ||
                (lowercaseBrand === retailer.toLowerCase()) ||
                (logo => logo.includes(retailer.toLowerCase()))(lowercaseName) && (lowercaseManufacturer === '' || lowercaseManufacturer === retailer.toLowerCase());


            if (isOwnBrand) {
                console.log(`Skipping own-brand: ${name} (Result: ${manufacturer || brandName})`);
                continue;
            }

            // Ensure Manufacturer column exists
            if (!manufacturer && brandName) manufacturer = brandName;

            // Image URL mapping
            const imageUrl = item.image || item.imageUrl || item.productImage || item.image_url || '';

            newRows.push({
                'product': name,
                'retailer': retailer,
                'product url': url,
                'price': item.price_display || (price ? `${currency} ${price}` : 'N/A'),
                'reviews': item.reviews || item.rating_count || item.reviewCount || 0,
                'date_found': new Date().toISOString().split('T')[0],
                'brand': brandName,
                'manufacturer': manufacturer,
                'category': item.category || 'New In',
                'rating_value': item.rating || item.rating_value || 0,
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
