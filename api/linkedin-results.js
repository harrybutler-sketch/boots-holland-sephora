import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from '../lib/google-auth.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const serviceAccountAuth = getGoogleAuth();
        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();

        const sheet = doc.sheetsByTitle['LinkedIn'];
        if (!sheet) {
            return res.status(200).json([]);
        }

        const rows = await sheet.getRows();
        
        const mappedItems = rows.map((row, index) => {
            return {
                id: row.get('id') || `linkedin-${index}`,
                brand: row.get('brand') || 'Unknown Brand',
                product: row.get('product') || 'Unknown Product',
                manufacturer: row.get('manufacturer') || 'Unknown Author',
                manufacturerUrl: row.get('manufacturer url') || '#',
                date: row.get('date') || row.get('Date') || 'Unknown',
                retailer: row.get('retailer') || row.get('Retailer') || 'Unknown',
                managingDirector: '', 
                marketingDirector: '', 
                postSnippet: row.get('post snippet') || '',
                type: row.get('type') || 'other',
                dealtWith: row.get('dealtWith') === 'TRUE',
                postUrl: row.get('post url') || '#'
            };
        });

        const fourWeeksAgo = new Date();
        fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

        const filteredItems = mappedItems.filter(item => {
            if (!item.date || item.date === 'Unknown') return true;
            
            // Try parsing as actual date
            const dateObj = new Date(item.date);
            if (!isNaN(dateObj.getTime())) {
                return dateObj >= fourWeeksAgo;
            }
            
            // Handle relative strings (e.g., "3 days ago")
            const lower = item.date.toLowerCase();
            const num = parseInt(lower);
            if (!isNaN(num)) {
                let daysAgo = 0;
                if (lower.includes('h')) daysAgo = num / 24;
                else if (lower.includes('d')) daysAgo = num;
                else if (lower.includes('w')) daysAgo = num * 7;
                else if (lower.includes('m') && !lower.includes('min')) daysAgo = num * 30;
                
                return daysAgo <= 28;
            }
            
            return true; // Fallback to show if we can't parse
        });

        return res.status(200).json(filteredItems);

    } catch (error) {
        console.error('Error fetching LinkedIn results from Sheets:', error);
        return res.status(500).json({ error: error.message || 'Failed to fetch results' });
    }
}

// Helpers
function extractRetailer(text) {
    if (!text) return null;
    const lowerText = text.toLowerCase();

    // Priority Retailers
    if (lowerText.includes('tesco')) return 'Tesco';
    if (lowerText.includes('sainsbury')) return 'Sainsbury\'s';
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

function extractBrand(text, authorName) {
    if (!text) return authorName;
    const lowerText = text.toLowerCase();

    // 1. Look for explicit Brand/Manufacturer tags
    const brandMatch = text.match(/(?:Brand|Manufacturer):\s*([A-Z][a-zA-Z0-9&\s]+?)(?:\.|\n|,|$)/i);
    if (brandMatch) return brandMatch[1].trim();

    // 2. Look for "from [Brand]" or "by [Brand]" immediately followed by a capitalized phrase
    const fromByMatch = text.match(/(?:from|by)\s+([A-Z][A-Za-z0-9&]+(?:\s+[A-Z][A-Za-z0-9&]+)*(?:\s+Ltd|\s+Brands|\s+Group)?)/);
    if (fromByMatch) return fromByMatch[1].trim();

    // 3. Hashtags: If there's a hashtag that matches the author name (or first part), or is a known FMCG pattern
    const hashtags = Array.from(text.matchAll(/#([a-zA-Z0-9_]+)/g)).map(m => m[1]);
    if (hashtags.length > 0) {
        // Simple camelCase splitter for the very first hashtag as a decent fallback
        const firstHashtagSplit = hashtags[0].replace(/([A-Z])/g, ' $1').trim();
        // If author name is known generic, use the hashtag. Otherwise, we might prefer author later.
        const genericAuthors = ['Retail Gazette', 'The Grocer', 'New Food Magazine', 'Trends', 'News', 'Media', 'Insight', 'Gymfluencers.com'];
        if (authorName && genericAuthors.some(ga => authorName.toLowerCase().includes(ga.toLowerCase()))) {
            return firstHashtagSplit;
        }
    }

    // 4. Default to Author if it sounds like a Company (Group, Ltd, Drinks, Beauty)
    const companyKeywords = ['ltd', 'limited', 'group', 'brands', 'drinks', 'beauty', 'foods', 'brewing', 'kombucha', 'nutrition'];
    if (authorName && companyKeywords.some(kw => authorName.toLowerCase().includes(kw))) {
        return authorName; // Clean copy of author
    }

    // 5. Fallback - attempt to rip the sentence with "launch"
    return 'Unknown Brand';
}

function extractProduct(text) {
    if (!text) return 'New Launch';
    const lowerText = text.toLowerCase();

    // 1. Look for explicit product names in quotes ('Product Name' or "Product Name" or ‘Product Name’)
    const quoteMatch = text.match(/(?:launched|introducing|unveiling|bringing you)\s+(?:.*?)(?:'|"|‘|“)(.+?)(?:'|"|’|”)/i);
    if (quoteMatch && quoteMatch[1] && quoteMatch[1].length > 3) {
        return quoteMatch[1].trim();
    }

    // 2. Look for capitalized phrases immediately following launch verbs
    // Matches "launched the new [Capitalized Phrase]"
    const capPhraseMatch = text.match(/(?:launched|introducing|announcing|unveiling|bringing you|rolling out)\s+(?:(?:our|the|a|new|brand new|exciting)\s+)*([A-Z][a-z0-9&']+(?:\s+[A-Z][a-z0-9&']+)*)/);

    if (capPhraseMatch && capPhraseMatch[1]) {
        const product = capPhraseMatch[1].trim();
        const ignored = ['New', 'Range', 'Products', 'Collection', 'Partnership', 'Stores'];
        // Ensure it's not just "New" or a generic word
        if (!ignored.includes(product) && product.length > 2) {
            return product;
        }
    }

    // 3. Fallback: Identify specific product descriptors if capitalization formatting failed
    if (lowerText.match(/(?:flavour|flavor|variant|edition)/)) {
        return 'New Variant/Flavour';
    }

    // 4. Extract snippet: if we can't find the name, grab the 6 words after "launch"
    const snippetMatch = lowerText.match(/launch(?:ed|ing)?\s+((?:\S+\s+){1,5}\S+)/);
    if (snippetMatch) {
        return '...' + snippetMatch[1].substring(0, 30) + '...';
    }

    return 'New Launch'; // Generic fallback
}

function isProductLaunch(text) {
    if (!text) return false;
    const lower = text.toLowerCase();

    // STRICT Negative Keywords (Job posts, Tech, B2B, etc.)
    const negativeKeywords = [
        // Jobs/Hiring
        'hiring', 'vacancy', 'job', 'recruit', 'career', 'opportunity', 'looking for a',
        'join our team', 'join the team', 'apply now', 'roles available', 'work with us',
        // Events/Content
        'report', 'whitepaper', 'webinar', 'seminar', 'conference', 'panel discussion',
        // Tech/B2B/SaaS
        'saas', 'software', 'app', 'b2b', 'platform', 'ai ', 'artificial intelligence',
        'plugin', 'dashboard', 'tech', 'automation', 'autonomous', 'api'
    ];

    if (negativeKeywords.some(kw => lower.includes(kw))) {
        // Double check: if it says "launching a NEW RANGE" it might still be valid even if it says "great job team"
        // But "job" or Tech words are tricky. Let's be stick with stricter negatives for "hiring" and "tech" context.
        if (negativeKeywords.some(kw => lower.includes(kw))) {
            return false;
        }
    }

    // Positive Keywords (Strong Intent for FMCG/Retail)
    const positiveKeywords = [
        // Launch specific
        'launch', 'listing', 'shelf', 'shelves', 'store', 'stockist', 'range', 'flavour', 'flavor', 'sku', 'fmcg', 'cpg',
        // Availability
        'available now', 'buy now', 'grab yours', 'find us', 'roll out', 'rolling out', 'landed', 'hitting', 'supermarket',
        // Specific Retailers
        'waitrose', 'tesco', 'sainsbury', 'asda', 'morrisons', 'ocado', 'boots', 'superdrug', 'sephora', 'holland & barrett', 'retailer'
    ];

    const hasPositive = positiveKeywords.some(kw => lower.includes(kw));

    // Must have at least one Retailer string AND a Launch/FMCG string to be highly confident
    const retailerKeywords = ['waitrose', 'tesco', 'sainsbury', 'asda', 'morrisons', 'ocado', 'boots', 'superdrug', 'sephora', 'holland & barrett'];
    const launchKeywords = ['launch', 'listing', 'shelf', 'shelves', 'stockist', 'range', 'available now', 'roll out', 'hitting', 'landed'];

    const hasRetailer = retailerKeywords.some(kw => lower.includes(kw));
    const hasLaunchLogic = launchKeywords.some(kw => lower.includes(kw));

    // Stricter return: Requires both a known retailer and a launch word
    return hasRetailer && hasLaunchLogic;
}
