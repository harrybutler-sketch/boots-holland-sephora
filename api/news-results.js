import { ApifyClient } from 'apify-client';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const client = new ApifyClient({
            token: process.env.APIFY_TOKEN,
        });

        // Get last successful run of the Google Search Scraper
        const runs = await client.actor('apify/google-search-scraper').runs().list({
            desc: true,
            limit: 1,
            status: 'SUCCEEDED'
        });

        if (runs.items.length === 0) {
            return res.status(200).json([]);
        }

        const lastRunId = runs.items[0].id;
        const dataset = await client.run(lastRunId).dataset();
        const { items } = await dataset.listItems();

        let allResults = [];

        // Google Search Scraper usually returns an array of query pages, each with organicResults
        items.forEach((page) => {
            if (page.organicResults && Array.isArray(page.organicResults)) {
                page.organicResults.forEach((result, index) => {
                    const textToAnalyze = `${result.title || ''} ${result.description || ''}`;

                    allResults.push({
                        id: `news-${page.searchQuery?.term}-${index}`,
                        source: extractSource(result.url || result.displayedUrl),
                        headline: result.title || 'Unknown Headline',
                        snippet: result.description || '',
                        articleUrl: result.url || '#',
                        date: extractDate(textToAnalyze) || 'Recent',
                        brand: extractBrandNews(textToAnalyze),
                        product: extractProductNews(textToAnalyze),
                        retailer: extractRetailerNews(textToAnalyze),
                        dealtWith: false
                    });
                });
            }
        });

        // Deduplicate by URL
        const uniqueResults = [];
        const seenUrls = new Set();
        for (const res of allResults) {
            if (!seenUrls.has(res.articleUrl)) {
                seenUrls.add(res.articleUrl);
                
                const isLaunch = isProductLaunch(res.headline + ' ' + res.snippet, res.retailer);
                res.type = isLaunch ? 'launch' : 'other';
                
                uniqueResults.push(res);
            }
        }

        return res.status(200).json(uniqueResults);

    } catch (error) {
        console.error('Error fetching News results:', error);
        return res.status(500).json({ error: error.message || 'Failed to fetch news results', stack: error.stack });
    }
}

// Helpers
function extractSource(url) {
    if (!url) return 'News Site';
    if (url.includes('thegrocer')) return 'The Grocer';
    if (url.includes('retailgazette')) return 'Retail Gazette';
    if (url.includes('talkingretail')) return 'Talking Retail';
    if (url.includes('conveniencestore')) return 'Convenience Store';
    if (url.includes('kamcity')) return 'KamCity';
    try {
        return (new URL(url).hostname).replace('www.', '');
    } catch {
        return url.substring(0, 30);
    }
}

function extractDate(text) {
    const match = text.match(/(\\d+\\s+(days?|hours?|weeks?|months?)\\s+ago)|((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\s+\\d{1,2}(?:,\\s+\\d{4})?)/i);
    return match ? match[0] : null;
}

function extractBrandNews(text) {
    // Quick heuristic: the first capitalized word/phrase before verbs like "launches", "unveils"
    const lower = text.toLowerCase();
    const match = text.match(/^([A-Z][a-zA-Z0-9&]+(?:\\s+[A-Z][a-zA-Z0-9&]+)?)\\s+(?:has\\s+)?(?:launched|unveiled|rolled out|expanded|introduced)/);
    if (match) return match[1].trim();

    // Or the subject of the sentence
    return 'Unknown Brand'; // Kept generic for MVP, can refine later like LinkedIn
}

function extractProductNews(text) {
    // Look for phrases like "its new [X]" or "a new [X]"
    const match = text.match(/(?:its|a|the)\\s+(?:new|latest|limited edition)\\s+([a-zA-Z0-9\\s&'-]+?)(?:\\s+range|\\s+in|\\s+at|\\s+for|\\.|\\,|$)/i);
    if (match) {
        const product = match[1].trim();
        if (product && product.length > 3) return product;
    }

    return 'New Launch';
}

function extractRetailerNews(text) {
    if (!text) return 'Unknown';
    const lowerText = text.toLowerCase();
    
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

function isProductLaunch(text, retailer) {
    if (!text) return false;

    // Constraint 1: Must be a specific retailer (No "Unknown")
    if (!retailer || retailer === 'Unknown') {
        return false;
    }

    const lower = text.toLowerCase();

    // STRICT Negative Keywords
    const negativeKeywords = [
        'hiring', 'vacancy', 'job', 'recruit', 'career', 'opportunity',
        'report', 'whitepaper', 'webinar', 'seminar', 'conference',
        'new store', 'new shop', 'new branch', 'managed store', 'convenience store', 'store opening',
        'opened', 'opening', 'expansion', 'refurbishment', 'refit', 'franchise',
        'ai agent', 'artificial intelligence', 'software', 'platform', 'app', 'update'
    ];

    if (negativeKeywords.some(kw => lower.includes(kw))) {
        if (lower.includes('hiring') || lower.includes('vacancy') || lower.includes('recruit')) {
            return false;
        }
        if (lower.includes('new store') || lower.includes('new shop') || lower.includes('opened')) {
            return false;
        }
    }

    // Positive Keywords (Strong Intent - MUST be present)
    const positiveKeywords = [
        'launch', 'listing', 'shelf', 'shelves', 'stockist', 'range', 'flavour', 'flavor',
        'sku', 'available now', 'buy now', 'grab yours', 'find us',
        'roll out', 'rolling out', 'landed', 'hitting', 'arrived', 'introducing'
    ];

    const hasPositive = positiveKeywords.some(kw => lower.includes(kw));

    return hasPositive;
}
