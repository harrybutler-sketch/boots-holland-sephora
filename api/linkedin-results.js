
import { ApifyClient } from 'apify-client';

export default async function handler(request, response) {
    // Similar to results.js but for LinkedIn data
    // For MVP, we might need to fetch from the LAST run of the LinkedIn Scraper
    // Or a specific dataset if we saved it somewhere.

    // For now, let's fetch the results of the *latest* run of the LinkedIn Actor.

    try {
        const client = new ApifyClient({
            token: process.env.APIFY_TOKEN,
        });

        // Get last run of the LinkedIn Actor
        const runs = await client.actor('harvestapi/linkedin-post-search-scraper').runs().list({
            desc: true,
            limit: 1,
            status: 'SUCCEEDED' // Only successful runs
        });

        if (runs.items.length === 0) {
            return response.json([]); // No runs found
        }

        const lastRunId = runs.items[0].id;
        const dataset = await client.run(lastRunId).dataset();
        const { items } = await dataset.listItems();

        // Transform items to match our Frontend Schema
        const mappedItems = items.map((item, index) => ({
            id: item.id || `linkedin-${index}`,
            brand: extractBrand(item.text) || 'Unknown Brand', // We need a helper for this
            product: extractProduct(item.text) || 'Unknown Product',
            manufacturer: item.authorName || 'Unknown Author',
            manufacturerUrl: item.authorUrl || '#',
            date: item.date || 'Unknown',
            retailer: extractRetailer(item.text) || 'Unknown Retailer',
            managingDirector: '', // Placeholder
            marketingDirector: '', // Placeholder
            postSnippet: item.text ? item.text.substring(0, 150) + '...' : '',
            dealtWith: false,
            postUrl: item.url
        }));

        return response.json(mappedItems);

    } catch (error) {
        console.error('Error fetching LinkedIn results:', error);
        return response.status(500).json({ error: 'Failed to fetch results' });
    }
}

// Helpers (Basic Regex for now, can be improved)
function extractRetailer(text) {
    if (!text) return null;
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

function extractBrand(text) {
    // Very basic: just return "Unknown" for now, or maybe the first capitalized word?
    // Real extraction needs NLP or the "Adjectives/Prefixes" logic we built for the main scraper.
    return 'Unknown Brand';
}

function extractProduct(text) {
    return 'Unknown Product';
}
