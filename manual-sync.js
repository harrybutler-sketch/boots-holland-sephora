
import { ApifyClient } from 'apify-client';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from './lib/google-auth.js';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

async function manualSync(runId, workspace = 'beauty') {
    if (!runId) {
        console.error('Error: runId is required');
        console.log('Usage: node manual-sync.js <RUN_ID> [workspace]');
        return;
    }

    try {
        console.log(`Syncing Run: ${runId} for Workspace: ${workspace}`);
        const dataset = await client.run(runId).dataset();
        const { items } = await dataset.listItems();
        console.log(`Found ${items.length} items in dataset.`);

        const auth = getGoogleAuth();
        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
        await doc.loadInfo();

        // Match production logic: Select by title based on workspace
        const sheetTitle = workspace === 'grocery' ? 'Grocery' : 'New In';
        let sheet = doc.sheetsByTitle[sheetTitle];

        if (!sheet) {
            console.error(`Sheet "${sheetTitle}" not found!`);
            return;
        }
        console.log(`Writing to sheet: ${sheetTitle}`);

        // Fetch existing rows for deduplication
        const rows = await sheet.getRows();
        const existingUrls = new Set(rows.map((row) => row.get('product url')));

        const newRows = [];
        let duplicateCount = 0;

        for (const item of items) {
            // Match production logic for URL extraction
            const url = item.url || item.productUrl || item.product_url || item.canonicalUrl;

            if (!url) {
                console.log('Skipping item with no URL:', JSON.stringify(item));
                continue;
            }

            if (existingUrls.has(url)) {
                duplicateCount++;
                continue;
            }

            // Match production logic for Name
            const name = item.title || item.name || item.productName || item.product_name || '';

            // FILTER: Skip generic "Choose a shade" listings
            if (name.toLowerCase().includes('choose a shade')) continue;

            if (!name) continue;

            // FILTER: exclude non-food items
            const lowerName = name.toLowerCase();
            const bannedKeywords = ['toaster', 'blender', 'microwave', 'electrical', 'appliance', 'menswear', 'womenswear', 'clothing'];

            // Smart "Kettle" check
            if (lowerName.includes('kettle') &&
                !lowerName.includes('chips') &&
                !lowerName.includes('crisps') &&
                !lowerName.includes('popcorn') &&
                !lowerName.includes('salt') &&
                !lowerName.includes('seasoning') &&
                !lowerName.includes('soup') &&
                !lowerName.includes('vegetable') &&
                !lowerName.includes('foods')) {

                // If it's just "Kettle" or "Electric Kettle" or in a non-food category
                if (lowerName.includes('electric') || lowerName.includes('cordless') || lowerName.includes('jug')) {
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


            // Match production logic for Brand
            const rawBrand = item.brand || item.brandName || (item.attributes && item.attributes.brand) || '';
            let brandName = (typeof rawBrand === 'string' ? rawBrand : (rawBrand && (rawBrand.name || rawBrand.title || rawBrand.slogan || rawBrand.label))) || '';

            if (brandName) {
                brandName = brandName
                    .replace(/^Shop all\s+/i, '')
                    .replace(/\s+(Ltd|Limited|Corp|Corporation|Inc|PLC)$/i, '')
                    .replace(/\.$/, '')
                    .trim();
                if (brandName.toLowerCase() === 'boots logo' || brandName.toLowerCase() === 'boots' || brandName.toLowerCase() === 'diet' || brandName.toLowerCase().includes('marketplace')) {
                    brandName = '';
                }
            }

            // 4. Final Fallback: Take first 1-2 words of name if they look like a brand
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
                        if (name.includes(' by ')) {
                            const byMatch = name.match(/ by ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/);
                            if (byMatch && byMatch[1]) {
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
                item.vendor || item.merchant || '';

            if (manufacturer) {
                manufacturer = manufacturer
                    .replace(/\s+(Ltd|Limited|Corp|Corporation|Inc|PLC)$/i, '')
                    .replace(/\.$/, '')
                    .trim();
                if (manufacturer.toLowerCase() === name.toLowerCase()) manufacturer = '';
            }

            const reviewCount = item.reviewCount || item.reviewsCount || item.reviews_count || item.rating_count ||
                (item.reviews && (typeof item.reviews === 'number' ? item.reviews : (item.reviews.count || item.reviews.total || item.reviews.total_reviews))) || 0;

            const ratingValue = item.rating || item.rating_value || item.ratingValue || '';

            const price = item.price_display || (item.offers?.price) || item.price || '';

            // Basic retailer detection for manual sync (production has more robust logic but this covers main ones)
            // Basic retailer detection for manual sync
            let retailer = 'Unknown';
            if (url.includes('sephora')) retailer = 'Sephora';
            else if (url.includes('hollandandbarrett')) retailer = 'Holland & Barrett';
            else if (url.includes('superdrug')) retailer = 'Superdrug';
            else if (url.includes('sainsburys')) retailer = 'Sainsburys';
            else if (url.includes('tesco')) retailer = 'Tesco';
            else if (url.includes('asda')) retailer = 'Asda';
            else if (url.includes('morrisons')) retailer = 'Morrisons';
            else if (url.includes('ocado')) retailer = 'Ocado';
            else if (url.includes('waitrose')) retailer = 'Waitrose';

            // FILTER: Skip own brands
            const ownBrandMap = {
                'Sephora': ['sephora', 'sephora collection'],
                'Holland & Barrett': ['holland', 'barrett', 'h&b', 'holland & barrett', 'holland and barrett'],
                'Sainsburys': ['sainsbury', 'hubbard', 'by sainsbury', 'sainsbury\'s', 'stamford street'],
                'Tesco': ['tesco', 'stockwell', 'ms molly', 'eastman', 'finest', 'creamfields', 'grower\'s harvest', 'hearty food co', 'romano', 'willow farm', 'redmere', 'nightingale', 'boswell'],
                'Asda': ['asda', 'extra special', 'just essentials', 'asda logo', 'george home'],
                'Morrisons': ['morrison', 'the best', 'savers', 'morrisons', 'nutmeg'],
                'Ocado': ['ocado', 'ocado own range', 'm&s', 'marks & spencer'],
                'Waitrose': ['waitrose', 'essential waitrose', 'no.1', 'duchy organic', 'waitrose & partners']
            };

            const lowercaseManufacturer = (manufacturer || '').toLowerCase();
            const lowercaseBrand = (brandName || '').toLowerCase();
            const lowercaseName = name.toLowerCase();
            const ownBrandKeywords = ownBrandMap[retailer] || [];

            const containsKeyword = (str) => ownBrandKeywords.some(kw => str.includes(kw));

            const isOwnBrand =
                containsKeyword(lowercaseManufacturer) ||
                containsKeyword(lowercaseBrand) ||
                (lowercaseBrand === retailer.toLowerCase()) ||
                (lowercaseBrand === 'asda logo') ||
                (containsKeyword(lowercaseName) && (lowercaseManufacturer === '' || lowercaseManufacturer === retailer.toLowerCase())); // Heuristic: Name contains retailer and no distinct manufacturer

            if (isOwnBrand) {
                console.log(`Skipping own-brand: ${name} (Result: ${manufacturer || brandName})`);
                continue;
            }


            const imageUrl = item.image || item.imageUrl || item.productImage || '';

            newRows.push({
                'product': name,
                'retailer': retailer,
                'product url': url,
                'price': price,
                'reviews': reviewCount,
                'date_found': new Date().toISOString().split('T')[0],
                'brand': brandName,
                'category': '',
                'rating_value': ratingValue,
                'run_id': runId,
                'scrape_timestamp': new Date().toISOString(),
                'status': 'Manual Sync',
                'manufacturer': manufacturer,
                'image_url': imageUrl
            });

            existingUrls.add(url);
        }

        if (newRows.length > 0) {
            console.log(`Adding ${newRows.length} rows to sheet...`);
            // Batch write
            const BATCH_SIZE = 50;
            for (let i = 0; i < newRows.length; i += BATCH_SIZE) {
                const chunk = newRows.slice(i, i + BATCH_SIZE);
                console.log(`Writing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(newRows.length / BATCH_SIZE)}...`);
                await sheet.addRows(chunk);
            }
            console.log(`Sync complete! Added ${newRows.length} items. Skipped ${duplicateCount} duplicates.`);
        } else {
            console.log(`No valid new rows found. Skipped ${duplicateCount} duplicates.`);
        }

    } catch (e) {
        console.error('FAILED SYNC:', e);
    }
}

// Get args from command line
const runIdArg = process.argv[2];
const workspaceArg = process.argv[3];
manualSync(runIdArg, workspaceArg);
