
import { ApifyClient } from 'apify-client';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from './lib/google-auth.js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
dotenv.config();

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

if (!APIFY_TOKEN || !GOOGLE_SHEET_ID) {
    console.error('Missing environment variables!');
    process.exit(1);
}

const client = new ApifyClient({ token: APIFY_TOKEN });

async function syncRunToSheet(runId, force = false) {
    try {
        console.log(`\n=== Syncing Run: ${runId} [Force: ${force}] ===`);
        const run = await client.run(runId).get();
        if (!run) {
            console.error('Run not found!');
            return;
        }

        console.log(`Status: ${run.status}`);

        // Fetch dataset
        console.log(`Fetching items from dataset ${run.defaultDatasetId}...`);
        const dataset = await client.dataset(run.defaultDatasetId).listItems();
        const items = dataset.items;

        console.log(`Fetched ${items.length} items from Apify dataset.`);

        // Google Sheets Auth
        const serviceAccountAuth = getGoogleAuth();
        const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();

        const grocerySheet = doc.sheetsByTitle['Grocery'];
        const beautySheet = doc.sheetsByTitle['New In'];

        const existingGroceryUrls = grocerySheet ? new Set((await grocerySheet.getRows()).map(r => r.get('product url') || r.get('Product URL'))) : new Set();
        const existingBeautyUrls = beautySheet ? new Set((await beautySheet.getRows()).map(r => r.get('product url') || r.get('Product URL'))) : new Set();

        const newGroceryRows = [];
        const newBeautyRows = [];
        let duplicateCount = 0;

        for (const item of items) {
            const url = item.url || item.productUrl || item.product_url || item.canonicalUrl;
            if (!url) continue;

            // Mapping Logic (Condensed)
            const name = item.title || item.name || item.productName || item.product_name || '';
            if (!name || name.toLowerCase().includes('choose a shade')) continue;

            const reviewCount = parseInt(item.reviews || item.ratingCount || 0);
            if (reviewCount > 5) continue;

            // Broadly identify retailer
            let retailer = item.retailer;
            if (!retailer && url) {
                const lowerUrl = url.toLowerCase();
                if (lowerUrl.includes('sephora.co.uk')) retailer = 'Sephora';
                else if (lowerUrl.includes('boots.com')) retailer = 'Boots';
                else if (lowerUrl.includes('sainsburys.co.uk')) retailer = 'Sainsburys';
                else if (lowerUrl.includes('tesco.com')) retailer = 'Tesco';
                else if (lowerUrl.includes('asda.com')) retailer = 'Asda';
                else if (lowerUrl.includes('morrisons.com')) retailer = 'Morrisons';
                else if (lowerUrl.includes('ocado.com')) retailer = 'Ocado';
                else if (lowerUrl.includes('waitrose.com')) retailer = 'Waitrose';
                else if (lowerUrl.includes('superdrug.com')) retailer = 'Superdrug';
            }

            const groceryRetailers = ['Tesco', 'Sainsburys', 'Asda', 'Morrisons', 'Waitrose', 'Ocado'];
            const isGrocery = groceryRetailers.some(gr => retailer && retailer.includes(gr));

            const targetSheet = isGrocery ? grocerySheet : beautySheet;
            const targetUrls = isGrocery ? existingGroceryUrls : existingBeautyUrls;
            const targetRows = isGrocery ? newGroceryRows : newBeautyRows;

            if (!targetSheet) continue;

            // Duplicate Check
            if (!force && targetUrls.has(url)) {
                duplicateCount++;
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
                // Special case for Waitrose No.1 and similar joined names
                if (name.startsWith('No.1')) {
                    brandName = 'No.1';
                } else {
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
                            const fillers = ['And', 'With', 'The', 'In', 'For', 'Of', 'At', 'By'];
                            if (secondOne && /^[A-Z]/.test(secondOne) && !fillers.includes(secondOne)) {
                                brandName = firstTwo;
                            } else {
                                const prefixes = ['Greasy', 'Oyster', 'Yellow', 'Red', 'Blue', 'Black', 'White', 'Silver', 'Gold', 'Wolf', 'Dark', 'Mud', 'Barefoot', 'Echo', 'Jam', 'Meat', 'Trivento', 'Casillero', 'Campo', 'Villa', 'Santa', 'Saint', 'St', 'Le', 'La', 'Les', 'El', 'Los', 'The', 'I', 'No.1'];
                                if (prefixes.includes(firstOne) || /^\d+$/.test(firstOne) || firstOne === 'Diet') {
                                    brandName = firstTwo;
                                } else {
                                    brandName = firstOne;
                                }
                            }
                        }
                    }
                }
            }

            // 5. Clean up glued numbers (e.g. "Cadbury3x" -> "Cadbury", "Terry's5x" -> "Terry's")
            if (brandName && brandName.length > 3 && !brandName.startsWith('No.')) {
                // If it starts with letters/apostrophes/ampersands and then hits a number, strip from the number onwards
                const sizeRegex = /^([a-zA-Z&'-]+?)(?:\d+.*)$/i;
                if (sizeRegex.test(brandName)) {
                    brandName = brandName.replace(sizeRegex, '$1').trim();
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
                'Waitrose': ['waitrose', 'essential waitrose', 'no.1', 'duchy organic', 'waitrose & partners', 'lovifeel', 'heston', 'duchy', 'essentials'],
                'Superdrug': ['superdrug', 'b.', 'b. by superdrug', 'studio', 'solait', 'me+', 'optimum', 'artisan']
            };

            const lowercaseManufacturer = (manufacturer || '').toLowerCase();
            const lowercaseBrand = (brandName || '').toLowerCase();
            const ownBrandKeywords = ownBrandMap[retailer] || [];

            const isOwnBrand = (item.status === 'Own Brand') || ownBrandKeywords.some(kw => {
                const match = lowercaseManufacturer.includes(kw) || lowercaseBrand.includes(kw);
                if (retailer === 'Waitrose' && (name.toLowerCase().includes('waitrose') || name.toLowerCase().includes('essential'))) return true;
                return match || (lowercaseBrand === retailer.toLowerCase());
            });

            if (isOwnBrand) continue;

            const rowData = {
                'date_found': new Date().toISOString().split('T')[0],
                'retailer': retailer || 'Unknown',
                'manufacturer': manufacturer,
                'product': name,
                'brand': brandName,
                'price': item.price_display || (item.price ? `GBP ${item.price}` : 'N/A'),
                'reviews': reviewCount,
                'rating_value': item.rating || 0,
                'product url': url,
                'status': 'New',
                'run_id': runId,
                'scrape_timestamp': new Date().toISOString(),
                'category': item.category || (isGrocery ? 'Grocery' : 'New In'),
                'image_url': item.image || item.imageUrl || ''
            };

            targetRows.push(rowData);
            targetUrls.add(url);
        }

        const updates = [
            { sheet: grocerySheet, rows: newGroceryRows, name: 'Grocery' },
            { sheet: beautySheet, rows: newBeautyRows, name: 'New In' }
        ];

        const totalAdded = updates.reduce((acc, u) => acc + u.rows.length, 0);
        const ZOHO_WEBHOOK_URL = process.env.ZOHO_FLOW_WEBHOOK_URL;
        const noZoho = process.argv.includes('--no-zoho');

        for (const update of updates) {
            if (update.rows.length > 0) {
                console.log(`Adding ${update.rows.length} rows to ${update.name}...`);
                await update.sheet.addRows(update.rows);

                if (ZOHO_WEBHOOK_URL && !noZoho) {
                    const sanitize = (str) => {
                        if (!str) return '';
                        return str
                            .replace(/&/g, ' and ')
                            .replace(/'/g, ' ')
                            .replace(/"/g, ' ')
                            .replace(/[()]/g, ' ')
                            .trim();
                    };

                    console.log(`Triggering Zoho Flow for ${update.rows.length} items from ${update.name}...`);
                    for (const row of update.rows) {
                        try {
                            const response = await fetch(ZOHO_WEBHOOK_URL, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    product: sanitize(row.product),
                                    manufacturer: sanitize(row.manufacturer),
                                    product_url: row['product url'],
                                    retailer: row.retailer,
                                    price: row.price,
                                    image_url: row.image_url || '',
                                    scrape_timestamp: row.scrape_timestamp,
                                    tag: "new in",
                                    tags: ["new in"]
                                })
                            });

                            if (!response.ok) {
                                const body = await response.text();
                                console.error(`Zoho Error [${row.product}]: Status ${response.status} - ${body}`);
                            }

                            // Add 10s delay to prevent Zoho Flow deactivation (410 Gone)
                            // Being extremely safe because Zoho kills the URL on any deactivation
                            await new Promise(resolve => setTimeout(resolve, 10000));
                        } catch (err) {
                            console.error('Zoho Fetch Error:', err.message);
                        }
                    }
                }
            }
        }

        console.log(`\nFinished. Added: ${totalAdded}, Duplicates skipped: ${duplicateCount}`);

    } catch (e) {
        console.error('Sync Error:', e);
    }
}

const args = process.argv.slice(2);
const runId = args[0];
const force = args.includes('--force');

if (!runId) {
    console.error('Usage: node sync-run-to-sheet.mjs <runId> [--force] [--no-zoho]');
    process.exit(1);
}

syncRunToSheet(runId, force);
