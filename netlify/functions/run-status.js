import { ApifyClient } from 'apify-client';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from '../../lib/google-auth.js';

// --- LINKEDIN & NEWS HELPERS ---
function extractRetailer(text) {
    if (!text) return 'Unknown';
    const lowerText = text.toLowerCase();
    if (lowerText.includes('tesco')) return 'Tesco';
    if (lowerText.includes("sainsbury")) return "Sainsbury's";
    if (lowerText.includes('boots')) return 'Boots';
    if (lowerText.includes('asda')) return 'Asda';
    if (lowerText.includes('morrisons')) return 'Morrisons';
    if (lowerText.includes('waitrose')) return 'Waitrose';
    if (lowerText.includes('ocado')) return 'Ocado';
    if (lowerText.includes('holland') || lowerText.includes('barrett')) return 'Holland & Barrett';
    if (lowerText.includes('superdrug')) return 'Superdrug';
    if (lowerText.includes('sephora')) return 'Sephora';
    if (lowerText.includes('the grocer')) return 'The Grocer';
    return 'Unknown';
}

function extractBrandLinkedin(text, authorName) {
    const genericAuthors = [
        'Retail Gazette', 'The Grocer', 'New Food Magazine', 'Trends', 'News', 'Media', 'Insight',
        'Tesco', 'Sainsbury', 'Asda', 'Morrisons', 'Waitrose', 'Ocado', 'Boots', 'Superdrug', 'Sephora', 'Holland & Barrett'
    ];
    if (authorName && !genericAuthors.some(ga => authorName.toLowerCase().includes(ga.toLowerCase()))) return authorName;
    const brandMatch = text.match(/(?:Brand|Manufacturer):\s*([A-Z][a-zA-Z0-9&\s]+?)(?:\.|\n|,|$)/i);
    if (brandMatch) return brandMatch[1].trim();
    const hashtagMatch = text.match(/#([A-Z][a-zA-Z0-9]+)/);
    if (hashtagMatch) return hashtagMatch[1].replace(/([A-Z])/g, ' $1').trim();
    const launchMatch = text.match(/([A-Z][a-zA-Z0-9&]+(?:\s+[A-Z][a-zA-Z0-9&]+)?)\s+(?:has\s+)?(?:launched|unveiled|introduced)/);
    if (launchMatch) return launchMatch[1].trim();
    return 'Unknown Brand';
}

function extractProductLinkedin(text) {
    const patterns = [
        /(?:launched|introducing|announcing|unveiling|bringing you)\s+(?:our\s+|the\s+|a\s+|new\s+)?([A-Z][a-zA-Z0-9\s&']{3,40})(?:\.|!|\n|with|at|in)/i,
        /new\s+([A-Z][a-zA-Z0-9\s&']{3,40})\s+(?:range|listing|launch)/i,
        /^([A-Z][a-zA-Z0-9\s&']{3,50})(?:\s+has\s+launched|\s+arrives|\s+hits)/m
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            const val = match[1].trim();
            const ignored = ['new', 'range', 'products', 'collection', 'collaboration', 'partnership', 'brand', 'launch'];
            if (!ignored.includes(val.toLowerCase())) return val;
        }
    }
    if (text.toLowerCase().includes('new ') && text.toLowerCase().includes('range')) return 'New Range';
    return 'New Launch';
}

function isProductLaunchLinkedin(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    const negativeKeywords = ['hiring', 'vacancy', 'job', 'recruit', 'career', 'opportunity', 'report', 'whitepaper', 'webinar', 'seminar', 'conference', 'new store', 'new shop', 'new branch', 'managed store', 'convenience store', 'store opening', 'opened', 'opening', 'expansion', 'refurbishment', 'refit', 'franchise', 'ai agent', 'software', 'platform', 'app', 'update'];
    if (negativeKeywords.some(kw => lower.includes(kw))) return false;
    const positiveKeywords = ['launch', 'listing', 'shelf', 'shelves', 'stockist', 'range', 'flavour', 'flavor', 'sku', 'available now', 'buy now', 'grab yours', 'find us', 'roll out', 'rolling out', 'landed', 'hitting', 'arrived', 'introducing'];
    return positiveKeywords.some(kw => lower.includes(kw));
}
// --- END HELPERS ---

export default async (req, context) => {
    if (req.method !== 'GET') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    const { runId, workspace = 'beauty' } = Object.fromEntries(new URL(req.url).searchParams);

    if (!runId) {
        return new Response(JSON.stringify({ error: 'runId is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

    try {
        const run = await client.run(runId).get();

        if (!run) {
            return new Response(JSON.stringify({ error: 'Run not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const terminalStatuses = ['SUCCEEDED', 'TIMED-OUT', 'ABORTED', 'FAILED'];
        const isTerminal = terminalStatuses.includes(run.status);

        if (!isTerminal) {
            return new Response(JSON.stringify({
                status: run.status,
                datasetId: run.defaultDatasetId,
                itemCount: run.stats?.itemCount || 0,
                message: 'Scrape in progress...'
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Run is terminal, process whatever we have in the dataset
        const dataset = await client.dataset(run.defaultDatasetId).listItems();
        const items = dataset.items;

        console.log(`Fetched ${items.length} items from Apify dataset (Run Status: ${run.status}).`);

        // Special handling for LinkedIn items: actorId 'buIWk2uOUzTmcLsuB'
        // and News items: actorId 'YJCnS9qogi9XxDgLB'
        const isLinkedinRun = run.actId === 'buIWk2uOUzTmcLsuB';
        const isNewsRun = run.actId === 'YJCnS9qogi9XxDgLB';
        const isLinkedInContext = isLinkedinRun || isNewsRun;

        if (items.length === 0) {
            return new Response(JSON.stringify({
                status: run.status,
                message: 'No items found. Skipping sync.'
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        console.log(`Fetched ${items.length} items from Apify dataset.`);
        if (items.length > 0) {
            console.log('First item structure:', JSON.stringify(items[0], null, 2));
        }

        // Google Sheets Auth
        const serviceAccountAuth = getGoogleAuth();

        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();

        // Select tab based on workspace/actor
        let sheetTitle = workspace === 'grocery' ? 'Grocery' : 'New In';
        if (isLinkedInContext) sheetTitle = 'LinkedIn';

        let sheet = doc.sheetsByTitle[sheetTitle];

        if (!sheet) {
            console.log(`Creating new sheet tab: ${sheetTitle}`);
            const headerValues = isLinkedInContext 
                ? ['id', 'brand', 'product', 'manufacturer', 'manufacturer url', 'date', 'retailer', 'type', 'post snippet', 'dealtWith', 'post url', 'scrape_timestamp']
                : ['date_found', 'retailer', 'manufacturer', 'product', 'brand', 'price', 'reviews', 'rating_value', 'product url', 'status', 'run_id', 'scrape_timestamp', 'category'];
            
            sheet = await doc.addSheet({
                title: sheetTitle,
                headerValues
            });
        }

        // Fetch existing rows for deduplication
        const rows = await sheet.getRows();
        // LinkedIn uses 'post url', Retailer uses 'product url'
        const urlColumn = isLinkedInContext ? 'post url' : 'product url';
        const existingUrls = new Set(rows.map((row) => row.get(urlColumn)));

        let appendedCount = 0;
        let duplicateCount = 0;
        const newRows = [];

        if (isLinkedInContext) {
            // LinkedIn Sync Logic
            for (const item of items) {
                let url, text, author, authorUrl, postDate;

                if (isLinkedinRun) {
                    url = item.linkedinUrl || item.url;
                    text = item.content || item.text || '';
                    author = (item.author && item.author.name) || item.authorName || 'Unknown Author';
                    authorUrl = (item.author && item.author.linkedinUrl) || item.authorUrl || '';
                    postDate = item.postedAt || item.date || item.timeRange || 'Unknown';
                    if (typeof postDate === 'object') postDate = postDate.date || postDate.text || 'Unknown';
                } else {
                    // News items are inside organicResults
                    if (item.organicResults && Array.isArray(item.organicResults)) {
                        for (const result of item.organicResults) {
                            const newsUrl = result.url || result.displayedUrl;
                            if (!newsUrl || existingUrls.has(newsUrl)) continue;

                            const newsText = `${result.title || ''} ${result.description || ''}`;
                            if (!newsText.toLowerCase().includes('new')) continue;

                            const retailer = extractRetailer(newsText);
                            const isLaunch = isProductLaunchLinkedin(newsText);
                            
                            newRows.push({
                                'id': '',
                                'brand': 'Unknown Brand', // Simplified for now
                                'product': result.title.substring(0, 50),
                                'manufacturer': (new URL(newsUrl).hostname).replace('www.', ''),
                                'manufacturer url': newsUrl,
                                'date': 'Recent',
                                'retailer': retailer,
                                'type': isLaunch ? 'launch' : 'other',
                                'post snippet': `NEWS: ${result.title} - ${result.description}`.substring(0, 250),
                                'dealtWith': 'FALSE',
                                'post url': newsUrl,
                                'scrape_timestamp': new Date().toISOString()
                            });
                            existingUrls.add(newsUrl);
                        }
                    }
                    continue;
                }

                if (!url || existingUrls.has(url)) {
                    if (url) duplicateCount++;
                    continue;
                }

                // Filtering from sync-news-linkedin-to-sheet.mjs
                const genericAuthors = ['Retail Gazette', 'The Grocer', 'New Food Magazine', 'Trends', 'News', 'Media', 'Insight', 'Tesco', 'Sainsbury', 'Asda', 'Morrisons', 'Waitrose', 'Ocado', 'Boots', 'Superdrug', 'Sephora', 'Holland & Barrett'];
                const isGenericAuthor = genericAuthors.some(ga => author.toLowerCase().includes(ga.toLowerCase()));
                if (isGenericAuthor && !text.toLowerCase().includes('new')) continue;

                const launchKeywords = ['launch', 'listing', 'shelf', 'shelves', 'stockist', 'range', 'available now', 'hitting', 'landed', 'introducing', 'new SKU', 'new flavor', 'new flavour', 'new variant', 'new scent'];
                const isRelevant = text.toLowerCase().includes('new product') || text.toLowerCase().includes('new launch') || launchKeywords.some(kw => text.toLowerCase().includes(kw.toLowerCase()));
                if (!isRelevant) continue;

                const retailer = extractRetailer(text);
                const isLaunch = isProductLaunchLinkedin(text);
                const finalRetailer = (retailer === 'Unknown' && author.toLowerCase().includes('the grocer')) ? 'The Grocer' : retailer;

                newRows.push({
                    'id': item.id || '',
                    'brand': extractBrandLinkedin(text, author) || 'Unknown Brand',
                    'product': extractProductLinkedin(text) || 'Unknown Product',
                    'manufacturer': author,
                    'manufacturer url': authorUrl,
                    'date': postDate,
                    'retailer': finalRetailer,
                    'type': isLaunch ? 'launch' : 'other',
                    'post snippet': text ? text.substring(0, 200).replace(/\n/g, ' ') + '...' : '',
                    'dealtWith': 'FALSE',
                    'post url': url,
                    'scrape_timestamp': new Date().toISOString()
                });
                existingUrls.add(url);
            }
        } else {
            // Retailer Sync Logic (Existing)
            // Ensure Manufacturer column exists
            if (!sheet.headerValues.includes('manufacturer')) {
                console.log('Adding manufacturer column to sheet...');
                await sheet.setHeaderRow([...sheet.headerValues, 'manufacturer']);
            }

            // Ensure image_url column exists
            if (!sheet.headerValues.includes('image_url')) {
                console.log('Adding image_url column to sheet...');
                await sheet.setHeaderRow([...sheet.headerValues, 'image_url']);
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
                else if (lowerUrl.includes('superdrug.com')) retailer = 'Superdrug';
                else if (lowerUrl.includes('sainsburys.co.uk')) retailer = 'Sainsburys';
                else if (lowerUrl.includes('tesco.com')) retailer = 'Tesco';
                else if (lowerUrl.includes('asda.com')) retailer = 'Asda';
                else if (lowerUrl.includes('morrisons.com')) retailer = 'Morrisons';
                else if (lowerUrl.includes('ocado.com')) retailer = 'Ocado';
                else if (lowerUrl.includes('waitrose.com')) retailer = 'Waitrose';
                else retailer = 'Unknown';
            }

            let name = item.title || item.name || item.productName || item.product_name || '';

            if (name && /[a-z][A-Z]/.test(name)) {
                name = name.replace(/(?<!\bMc)(?<!\bMac)([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
            }


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

            if (brandName && /[a-z][A-Z]/.test(brandName)) {
                brandName = brandName.replace(/(?<!\bMc)(?<!\bMac)([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
            }

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

            let manufacturer = (typeof item.manufacturer === 'string' ? item.manufacturer : (item.manufacturer && item.manufacturer.name)) ||
                item.vendor ||
                item.merchant ||
                brandName ||
                '';

            // 6. Extract corporate client from Manufacturer Address block
            if (item.manufacturer_address) {
                const lowerAddress = item.manufacturer_address.toLowerCase();
                const mfnDict = {
                    "pepsico": "PepsiCo",
                    "pepsi-cola": "PepsiCo",
                    "coca-cola europacific": "CCEP",
                    "ccep": "CCEP",
                    "a.g. barr": "AG Barr",
                    "ag barr": "AG Barr",
                    "ferrero": "Ferrero",
                    "unilever": "Unilever",
                    "nestle": "Nestle",
                    "mars ": "Mars",
                    "mondelez": "Mondelez",
                    "premier foods": "Premier Foods",
                    "britvic": "Britvic",
                    "arla ": "Arla",
                    "danone": "Danone",
                    "l'oreal": "L'Oreal",
                    "reckitt": "Reckitt",
                    "haleon": "Haleon",
                    "pladis": "Pladis",
                    "kellogg": "Kellanova (Kellogg's)",
                    "general mills": "General Mills",
                    "kraft heinz": "Kraft Heinz",
                    "procter & gamble": "P&G",
                    "p&g": "P&G",
                    "estee lauder": "Estée Lauder",
                    "estée lauder": "Estée Lauder",
                    "coty ": "Coty",
                    "shiseido ": "Shiseido",
                    "lvmh ": "LVMH",
                    "johnson & johnson": "Johnson & Johnson",
                    "kenvue": "Kenvue",
                    "beiersdorf": "Beiersdorf",
                    "puig ": "Puig",
                    "naturactor": "Natura &Co",
                    "natura &co": "Natura &Co",
                    "kao ": "Kao",
                    "amorepacific": "Amorepacific",
                    "clarins ": "Clarins",
                    "huel ": "Huel"
                };

                let foundCorporate = false;
                for (const [key, val] of Object.entries(mfnDict)) {
                    if (lowerAddress.includes(key)) {
                        manufacturer = val;
                        foundCorporate = true;
                        break;
                    }
                }

                // Fallback to Regex for corporate suffixes
                if (!foundCorporate) {
                    const corporateRegex = /([A-Z][A-Za-z0-9&\\s\\-\\']+(?:Ltd|Limited|PLC|UC|Inc|Corp|Corporation|Partners|GmbH|Group))/i;
                    const match = item.manufacturer_address.match(corporateRegex);
                    if (match && match[1]) {
                        manufacturer = match[1].trim()
                            .replace(/^By\\s+/i, '')
                            .replace(/^Return to\\s+/i, '');
                    } else {
                        // Break address by comma/period and take first non-PO box part
                        const parts = item.manufacturer_address.split(/,|\\.|;/);
                        const firstPart = parts[0] ? parts[0].trim() : '';
                        const secondPart = parts.length > 1 ? parts[1].trim() : '';

                        // If Tropicana is first part, it might just be the brand. We can at least use it if manufacturer is empty.
                        if (firstPart && firstPart.length < 40 && !firstPart.toLowerCase().includes('freepost') && !firstPart.toLowerCase().includes('box')) {
                            // If the second part has a corporate suffix, take that piece instead
                            if (secondPart && corporateRegex.test(secondPart)) {
                                manufacturer = secondPart.trim();
                            } else if (!manufacturer || manufacturer === brandName) {
                                manufacturer = firstPart;
                            }
                        }
                    }
                }
            }

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
            const lowercaseName = name.toLowerCase();
            const ownBrandKeywords = ownBrandMap[retailer] || [];

            const isOwnBrand = (item.status === 'Own Brand') || ownBrandKeywords.some(kw => {
                const match = lowercaseManufacturer.includes(kw) ||
                    lowercaseBrand.includes(kw) ||
                    (lowercaseName.includes(kw) && !isFoodKettle);

                // Extra safety: Waitrose specific substring match for name
                if (retailer === 'Waitrose' && (lowercaseName.includes('waitrose') || lowercaseName.includes('essential'))) return true;

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
                'status': 'Pending',
                'run_id': runId,
                'scrape_timestamp': new Date().toISOString(),
                'image_url': imageUrl
            });

                existingUrls.add(url);
            }
        } // END OF ELSE (isLinkedInContext)

        // Batch write to avoid timeouts/limits
        if (newRows.length > 0) {
            const BATCH_SIZE = 50;
            for (let i = 0; i < newRows.length; i += BATCH_SIZE) {
                const chunk = newRows.slice(i, i + BATCH_SIZE);
                console.log(`Writing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(newRows.length / BATCH_SIZE)}...`);
                await sheet.addRows(chunk);
            }
            appendedCount = newRows.length;

            // ZOHO FLOW INTEGRATION
            const ZOHO_WEBHOOK_URL = process.env.ZOHO_FLOW_WEBHOOK_URL;
            if (ZOHO_WEBHOOK_URL && !isLinkedInContext) {
                console.log(`Sending ${newRows.length} items to Zoho Flow...`);
                // We send them individually as Zoho Flow expects one object per task
                for (const row of newRows) {
                    try {
                        const sanitize = (str) => {
                            if (!str) return '';
                            return str
                                .replace(/&/g, ' and ')
                                .replace(/'/g, ' ')
                                .replace(/"/g, ' ')
                                .replace(/[()]/g, ' ')
                                .trim();
                        };

                        await fetch(ZOHO_WEBHOOK_URL, {
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

                        // Add 5s delay to prevent Zoho Flow deactivation (410 Gone)
                        await new Promise(resolve => setTimeout(resolve, 5000));
                    } catch (err) {
                        console.error('Failed to trigger Zoho Flow for item:', row.product, err.message);
                    }
                }
            } else {
                console.log('Zoho Flow Webhook URL not configured. Skipping webhook.');
            }
        }

        return new Response(JSON.stringify({
            status: 'SUCCEEDED',
            datasetId: run.defaultDatasetId,
            itemCount: items.length,
            appendedCount,
            duplicateCount,
            lastUpdated: new Date().toISOString(),
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error checking status:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
