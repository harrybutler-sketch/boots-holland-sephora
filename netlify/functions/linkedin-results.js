import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from '../../lib/google-auth.js';

export default async (req, context) => {
    try {
        const serviceAccountAuth = getGoogleAuth();
        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();

        const sheet = doc.sheetsByTitle['LinkedIn'];
        if (!sheet) {
             return new Response(JSON.stringify([]), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const rows = await sheet.getRows();
        
        const mappedItems = rows.map((row, index) => {
            return {
                id: row.get('id') || `linkedin-${index}`,
                brand: row.get('brand') || 'Unknown Brand',
                product: row.get('product') || 'Unknown Product',
                manufacturer: row.get('manufacturer') || 'Unknown Author',
                manufacturerUrl: row.get('manufacturer url') || '#',
                date: row.get('date') || 'Unknown',
                retailer: row.get('retailer') || 'Unknown',
                managingDirector: '', 
                marketingDirector: '', 
                postSnippet: row.get('post snippet') || '',
                type: row.get('type') || 'other',
                dealtWith: row.get('dealtWith') === 'TRUE',
                postUrl: row.get('post url') || '#'
            };
        });

        return new Response(JSON.stringify(mappedItems), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error fetching LinkedIn results from Sheets:', error);
        return new Response(JSON.stringify({ error: error.message || 'Failed to fetch results' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

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

    return 'Unknown';
}

function extractBrand(text, authorName) {
    // 1. If the author is NOT a generic news/aggregator, it's likely the brand
    const genericAuthors = ['Retail Gazette', 'The Grocer', 'New Food Magazine', 'Trends', 'News', 'Media', 'Insight'];
    if (authorName && !genericAuthors.some(ga => authorName.includes(ga))) {
        return authorName;
    }

    // 2. Look for "Brand: X" or "Manufacturer: X"
    const brandMatch = text.match(/(?:Brand|Manufacturer):\s*([A-Z][a-zA-Z0-9&\s]+?)(?:\.|\n|,|$)/i);
    if (brandMatch) return brandMatch[1].trim();

    // 3. Hashtags are often the brand
    const hashtagMatch = text.match(/#([A-Z][a-zA-Z0-9]+)/);
    if (hashtagMatch) {
        // camelsplit: "OcadoLogistics" -> "Ocado Logistics"
        return hashtagMatch[1].replace(/([A-Z])/g, ' $1').trim();
    }

    return 'Unknown Brand';
}

function extractProduct(text) {
    const lowerText = text.toLowerCase();

    // 1. Look for definitive launch phrases
    // "launched X", "introducing X", "new X"
    const launchRegex = /(?:launched|introducing|announcing|unveiling|bringing you)\s+(?:our\s+|the\s+|a\s+|new\s+)?([A-Z][a-zA-Z0-9\s&']{3,30})(?:\.|!|\n|with|at|in)/i;
    const match = text.match(launchRegex);

    if (match && match[1]) {
        // Filter out generic words if captured
        const ignored = ['new', 'range', 'products', 'collection', 'collaboration', 'partnership'];
        if (!ignored.includes(match[1].toLowerCase().trim())) {
            return match[1].trim();
        }
    }

    // 2. Identify "New [Key Phrase]" pattern
    if (lowerText.includes('new ') && lowerText.includes('range')) {
        return 'New Range';
    }

    return 'New Launch'; // Generic fallback is better than "Unknown"
}

function isProductLaunch(text, retailer) {
    if (!text) return false;

    // Constraint 1: Must be a specific retailer (No "Unknown")
    if (!retailer || retailer === 'Unknown') {
        return false;
    }

    const lower = text.toLowerCase();

    // STRICT Negative Keywords (Job posts, Reports, Webinars, Store Openings)
    const negativeKeywords = [
        // Jobs / Hiring
        'hiring', 'vacancy', 'job', 'recruit', 'career', 'opportunity', 'looking for a',
        'join our team', 'join the team', 'apply now', 'roles available', 'work with us',

        // Content / Events
        'report', 'whitepaper', 'webinar', 'seminar', 'conference', 'panel discussion',

        // Store Openings / Corporate News (NOT Product Launches)
        'new store', 'new shop', 'new branch', 'managed store', 'convenience store', 'store opening',
        'opened', 'opening', 'expansion', 'refurbishment', 'refit', 'franchise',

        // Tech / AI / Software (NOT Retail Products)
        'ai agent', 'artificial intelligence', 'llm', 'gpt', 'claude', 'anthropic', 'open ai', 'openai',
        'software', 'platform', 'app', 'feature', 'update', 'integration', 'automating', 'automation',
        'no-code', 'saas', 'tech', 'technology', 'digital', 'transformation'
    ];

    if (negativeKeywords.some(kw => lower.includes(kw))) {
        // Double check: if it says "launching a NEW RANGE" it might still be valid even if it says "great job team"
        // But "job" is tricky. Let's start with strict negatives.
        if (lower.includes('hiring') || lower.includes('vacancy') || lower.includes('recruit')) {
            return false;
        }
        // If it explicitly says "new store", it's likely not a product launch
        if (lower.includes('new store') || lower.includes('new shop') || lower.includes('opened')) {
            return false;
        }
    }

    // Positive Keywords (Strong Intent - MUST be present)
    const positiveKeywords = [
        'launch', 'listing', 'shelf', 'shelves', 'stockist', 'range', 'flavour', 'flavor',
        'sku', 'available now', 'buy now', 'grab yours', 'find us',
        'roll out', 'rolling out', 'landed', 'hitting', 'arrived', 'introducing'
        // Removed 'store' as it captures "Asda Express has launched *stores*"
    ];

    // Note: We don't check for retailer names in positiveKeywords here, because we already checked the 'retailer' variable above.
    // We want to ensure there is ACTION language ("launched", "available") + RETAILER context.

    const hasPositive = positiveKeywords.some(kw => lower.includes(kw));

    return hasPositive;
}
