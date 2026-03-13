
import { ApifyClient } from 'apify-client';

export default async function handler(req, res) {
    // Vercel Serverless Function (Node.js)

    try {
        const client = new ApifyClient({
            token: process.env.APIFY_TOKEN,
        });

        // Get last run of the LinkedIn Actor (CORRECT ID: harvestapi/linkedin-post-search)
        const runs = await client.actor('harvestapi/linkedin-post-search').runs().list({
            desc: true,
            limit: 1,
            status: 'SUCCEEDED' // Only successful runs
        });

        if (runs.items.length === 0) {
            return res.status(200).json([]);
        }

        const lastRunId = runs.items[0].id;
        const dataset = await client.run(lastRunId).dataset();
        const { items } = await dataset.listItems();

        // Transform items to match our Frontend Schema
        const mappedItems = items.map((item, index) => {
            const text = item.content || item.text || '';
            const author = item.author ? item.author.name : (item.authorName || 'Unknown Author');

            return {
                id: item.id || `linkedin-${index}`,
                brand: extractBrand(text, author) || 'Unknown Brand',
                product: extractProduct(text) || 'Unknown Product',
                manufacturer: author,
                manufacturerUrl: (item.author && item.author.linkedinUrl) || item.authorUrl || '#',
                date: (item.postedAt && item.postedAt.date) || item.date || 'Unknown',
                retailer: extractRetailer(text) || 'Unknown Retailer',
                managingDirector: '', // Placeholder
                marketingDirector: '', // Placeholder
                postSnippet: text ? text.substring(0, 150) + '...' : '',
                fullText: text, // Keep full text for categorization
                dealtWith: false,
                postUrl: item.linkedinUrl || item.url || '#'
            };
        });

        // Filter for posts within the last 4 weeks (28 days)
        const fourWeeksAgo = new Date();
        fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

        const filteredItems = mappedItems.filter(item => {
            // 1. Date Filter
            if (item.date && item.date !== 'Unknown' && new Date(item.date) < fourWeeksAgo) {
                return false;
            }
            return true;
        }).map(item => {
            // 2. Assign Type based on FULL text
            const isLaunch = isProductLaunch(item.fullText);
            
            // Clean up fullText so we don't bloat the payload
            delete item.fullText;
            
            return {
                ...item,
                type: isLaunch ? 'launch' : 'other'
            };
        });

        return res.status(200).json(filteredItems);

    } catch (error) {
        console.error('Error fetching LinkedIn results:', error);
        return res.status(500).json({ error: error.message || 'Failed to fetch results', stack: error.stack });
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
