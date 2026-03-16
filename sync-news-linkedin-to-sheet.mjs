import { ApifyClient } from 'apify-client';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getGoogleAuth } from './lib/google-auth.js';
import dotenv from 'dotenv';
dotenv.config();

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

if (!APIFY_TOKEN || !GOOGLE_SHEET_ID) {
    console.error('Missing environment variables!');
    process.exit(1);
}

const client = new ApifyClient({ token: APIFY_TOKEN });

// Utility functions from existing API
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
    return 'Unknown Brand';
}

function extractProductLinkedin(text) {
    const lowerText = text.toLowerCase();
    const launchRegex = /(?:launched|introducing|announcing|unveiling|bringing you)\s+(?:our\s+|the\s+|a\s+|new\s+)?([A-Z][a-zA-Z0-9\s&']{3,30})(?:\.|!|\n|with|at|in)/i;
    const match = text.match(launchRegex);
    if (match && match[1]) {
        const ignored = ['new', 'range', 'products', 'collection', 'collaboration', 'partnership'];
        if (!ignored.includes(match[1].toLowerCase().trim())) return match[1].trim();
    }
    if (lowerText.includes('new ') && lowerText.includes('range')) return 'New Range';
    return 'New Launch';
}

function isProductLaunchLinkedin(text, retailer) {
    if (!text || !retailer || retailer === 'Unknown') return false;
    const lower = text.toLowerCase();
    const negativeKeywords = ['hiring', 'vacancy', 'job', 'recruit', 'career', 'opportunity', 'report', 'whitepaper', 'webinar', 'seminar', 'conference', 'new store', 'new shop', 'new branch', 'managed store', 'convenience store', 'store opening', 'opened', 'opening', 'expansion', 'refurbishment', 'refit', 'franchise', 'ai agent', 'artificial intelligence', 'software', 'platform', 'app', 'update'];
    if (negativeKeywords.some(kw => lower.includes(kw))) {
        if (lower.includes('hiring') || lower.includes('vacancy') || lower.includes('recruit') || lower.includes('new store') || lower.includes('new shop') || lower.includes('opened')) return false;
    }
    const positiveKeywords = ['launch', 'listing', 'shelf', 'shelves', 'stockist', 'range', 'flavour', 'flavor', 'sku', 'available now', 'buy now', 'grab yours', 'find us', 'roll out', 'rolling out', 'landed', 'hitting', 'arrived', 'introducing'];
    return positiveKeywords.some(kw => lower.includes(kw));
}

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

function extractDateNews(text) {
    const match = text.match(/(\\d+\\s+(days?|hours?|weeks?|months?)\\s+ago)|((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\s+\\d{1,2}(?:,\\s+\\d{4})?)/i);
    return match ? match[0] : null;
}

function extractBrandNews(text) {
    const match = text.match(/^([A-Z][a-zA-Z0-9&]+(?:\\s+[A-Z][a-zA-Z0-9&]+)?)\\s+(?:has\\s+)?(?:launched|unveiled|rolled out|expanded|introduced)/);
    if (match) return match[1].trim();
    return 'Unknown Brand';
}

function extractProductNews(text) {
    const match = text.match(/(?:its|a|the)\\s+(?:new|latest|limited edition)\\s+([a-zA-Z0-9\\s&'-]+?)(?:\\s+range|\\s+in|\\s+at|\\s+for|\\.|\\,|$)/i);
    if (match && match[1]) {
        const product = match[1].trim();
        if (product.length > 3) return product;
    }
    return 'New Launch';
}

async function syncNewsLinkedinToSheet() {
    try {
        console.log(`\n=== Starting Sync for News & LinkedIn ===`);
        
        // 1. Google Sheets Auth
        const serviceAccountAuth = getGoogleAuth();
        const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();

        const linkedinSheet = doc.sheetsByTitle['LinkedIn'];
        const newsSheet = doc.sheetsByTitle['News'];

        if (!linkedinSheet || !newsSheet) {
            console.error('LinkedIn or News missing in Google Sheet! Please create them.');
            return;
        }

        const existingLinkedinUrls = new Set((await linkedinSheet.getRows()).map(r => r.get('post url') || r.get('Post URL')));
        const existingNewsUrls = new Set((await newsSheet.getRows()).map(r => r.get('article url') || r.get('Article URL')));

        // 2. LinkedIn Data
        console.log('Fetching LinkedIn data...');
        const linkedinRuns = await client.actor('harvestapi/linkedin-post-search').runs().list({ desc: true, limit: 1 });
        const newLinkedinRows = [];
        
        if (linkedinRuns.items.length > 0) {
            const dataset = await client.run(linkedinRuns.items[0].id).dataset();
            const { items } = await dataset.listItems();
            
            for (const item of items) {
                const url = item.linkedinUrl || item.url;
                if (!url || existingLinkedinUrls.has(url)) continue;
                
                const text = item.content || item.text || '';
                const author = item.author ? item.author.name : (item.authorName || 'Unknown Author');
                const retailer = extractRetailer(text);
                const isLaunch = isProductLaunchLinkedin(text, retailer);
                
                newLinkedinRows.push({
                    'id': item.id || '',
                    'brand': extractBrandLinkedin(text, author) || 'Unknown Brand',
                    'product': extractProductLinkedin(text) || 'Unknown Product',
                    'manufacturer': author,
                    'manufacturer url': (item.author && item.author.linkedinUrl) || item.authorUrl || '',
                    'date': (item.postedAt && item.postedAt.date) || item.date || 'Unknown',
                    'retailer': retailer,
                    'type': isLaunch ? 'launch' : 'other',
                    'post snippet': text ? text.substring(0, 150) + '...' : '',
                    'dealtWith': 'FALSE',
                    'post url': url,
                    'scrape_timestamp': new Date().toISOString()
                });
                existingLinkedinUrls.add(url);
            }
        }

        // 3. News Data
        console.log('Fetching News data...');
        const newsRuns = await client.actor('apify/google-search-scraper').runs().list({ desc: true, limit: 1 });
        const newNewsRows = [];
        
        if (newsRuns.items.length > 0) {
            const dataset = await client.run(newsRuns.items[0].id).dataset();
            const { items } = await dataset.listItems();
            
            items.forEach((page) => {
                if (page.organicResults && Array.isArray(page.organicResults)) {
                    page.organicResults.forEach((result) => {
                        const url = result.url || result.displayedUrl;
                        if (!url || existingNewsUrls.has(url)) return;

                        const textToAnalyze = `${result.title || ''} ${result.description || ''}`;
                        const retailer = extractRetailer(textToAnalyze);
                        const isLaunch = isProductLaunchLinkedin(textToAnalyze, retailer);

                        newNewsRows.push({
                            'id': '',
                            'source': extractSource(url),
                            'headline': result.title || 'Unknown Headline',
                            'snippet': result.description || '',
                            'article url': url,
                            'date': extractDateNews(textToAnalyze) || 'Recent',
                            'brand': extractBrandNews(textToAnalyze),
                            'product': extractProductNews(textToAnalyze),
                            'retailer': retailer,
                            'type': isLaunch ? 'launch' : 'other',
                            'dealtWith': 'FALSE',
                            'scrape_timestamp': new Date().toISOString()
                        });
                        existingNewsUrls.add(url);
                    });
                }
            });
        }

        // 4. Save to Sheets
        const updates = [
            { sheet: linkedinSheet, rows: newLinkedinRows, name: 'LinkedIn' },
            { sheet: newsSheet, rows: newNewsRows, name: 'News' }
        ];

        let totalAdded = 0;
        for (const update of updates) {
            if (update.rows.length > 0) {
                console.log(`Adding ${update.rows.length} rows to ${update.name}...`);
                await update.sheet.setHeaderRow(Object.keys(update.rows[0]));
                await update.sheet.addRows(update.rows);
                totalAdded += update.rows.length;
            }
        }

        console.log(`\nFinished. Added total of: ${totalAdded} new items`);

    } catch (e) {
        console.error('API Error:', e);
    }
}

syncNewsLinkedinToSheet();
