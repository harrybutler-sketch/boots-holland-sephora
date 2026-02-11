
import { ApifyClient } from 'apify-client';

export default async (req, context) => {
    // Similar to results.js but for LinkedIn data
    // For MVP, we might need to fetch from the LAST run of the LinkedIn Scraper
    // Or a specific dataset if we saved it somewhere.

    // For now, let's fetch the results of the *latest* run of the LinkedIn Actor.

    try {
        const client = new ApifyClient({
            token: process.env.APIFY_TOKEN,
        });

        // Get last run of the LinkedIn Actor
        const runs = await client.actor('harvestapi/linkedin-post-search').runs().list({
            desc: true,
            limit: 1,
            status: 'SUCCEEDED' // Only successful runs
        });

        if (runs.items.length === 0) {
            return new Response(JSON.stringify([]), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
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

            // 2. Content Filter (Product Launches ONLY)
            return isProductLaunch(item.postSnippet);
        });

        return new Response(JSON.stringify(filteredItems), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error fetching LinkedIn results:', error);
        return new Response(JSON.stringify({ error: error.message || 'Failed to fetch results', stack: error.stack }), {
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

function isProductLaunch(text) {
    if (!text) return false;
    const lower = text.toLowerCase();

    // STRICT Negative Keywords (Job posts, etc.)
    const negativeKeywords = [
        'hiring', 'vacancy', 'job', 'recruit', 'career', 'opportunity', 'looking for a',
        'join our team', 'join the team', 'apply now', 'roles available', 'work with us',
        'report', 'whitepaper', 'webinar', 'seminar', 'conference', 'panel discussion'
    ];

    if (negativeKeywords.some(kw => lower.includes(kw))) {
        // Double check: if it says "launching a NEW RANGE" it might still be valid even if it says "great job team"
        // But "job" is tricky. Let's be stick with stricter negatives for "hiring" context.
        if (lower.includes('hiring') || lower.includes('vacancy') || lower.includes('recruit')) {
            return false;
        }
    }

    // Positive Keywords (Strong Intent)
    const positiveKeywords = [
        'launch', 'listing', 'shelf', 'shelves', 'store', 'stockist', 'range', 'flavour', 'flavor',
        'sku', 'available now', 'buy now', 'grab yours', 'find us', 'waitrose', 'tesco', 'sainsbury',
        'asda', 'morrisons', 'ocado', 'boots', 'superdrug', 'sephora', 'holland & barrett', 'retailer',
        'roll out', 'rolling out', 'landed', 'hitting'
    ];

    const hasPositive = positiveKeywords.some(kw => lower.includes(kw));

    return hasPositive;
}
