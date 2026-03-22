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
    if (lowerText.includes('the grocer')) return 'The Grocer';
    return 'Unknown';
}

function extractBrandLinkedin(text, authorName) {
    const genericAuthors = [
        'Retail Gazette', 'The Grocer', 'New Food Magazine', 'Trends', 'News', 'Media', 'Insight',
        'Tesco', 'Sainsbury', 'Asda', 'Morrisons', 'Waitrose', 'Ocado', 'Boots', 'Superdrug', 'Sephora', 'Holland & Barrett'
    ];
    // If author is not a retailer/news site, assume author is the brand
    if (authorName && !genericAuthors.some(ga => authorName.toLowerCase().includes(ga.toLowerCase()))) return authorName;
    
    // Otherwise try to find brand in text
    const brandMatch = text.match(/(?:Brand|Manufacturer):\s*([A-Z][a-zA-Z0-9&\s]+?)(?:\.|\n|,|$)/i);
    if (brandMatch) return brandMatch[1].trim();
    
    const hashtagMatch = text.match(/#([A-Z][a-zA-Z0-9]+)/);
    if (hashtagMatch) return hashtagMatch[1].replace(/([A-Z])/g, ' $1').trim();
    
    // Last resort: look for capitalized words before "has launched"
    const launchMatch = text.match(/([A-Z][a-zA-Z0-9&]+(?:\s+[A-Z][a-zA-Z0-9&]+)?)\s+(?:has\s+)?(?:launched|unveiled|introduced)/);
    if (launchMatch) return launchMatch[1].trim();

    return 'Unknown Brand';
}

function extractProductLinkedin(text) {
    const lowerText = text.toLowerCase();
    
    // Patterns for finding product names
    const patterns = [
        /(?:launched|introducing|announcing|unveiling|bringing you)\s+(?:our\s+|the\s+|a\s+|new\s+)?([A-Z][a-zA-Z0-9\s&']{3,40})(?:\.|!|\n|with|at|in)/i,
        /new\s+([A-Z][a-zA-Z0-9\s&']{3,40})\s+(?:range|listing|launch)/i,
        /^([A-Z][a-zA-Z0-9\s&']{3,50})(?:\s+has\s+launched|\s+arrives|\s+hits)/m // Headline style
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            const val = match[1].trim();
            const ignored = ['new', 'range', 'products', 'collection', 'collaboration', 'partnership', 'brand', 'launch'];
            if (!ignored.includes(val.toLowerCase())) return val;
        }
    }

    if (lowerText.includes('new ') && lowerText.includes('range')) return 'New Range';
    return 'New Launch';
}

function isProductLaunchLinkedin(text, retailer) {
    if (!text) return false;
    const lower = text.toLowerCase();
    
    // If it's from a known generic author (like The Grocer), we are more lenient
    const negativeKeywords = ['hiring', 'vacancy', 'job', 'recruit', 'career', 'opportunity', 'report', 'whitepaper', 'webinar', 'seminar', 'conference', 'new store', 'new shop', 'new branch', 'managed store', 'convenience store', 'store opening', 'opened', 'opening', 'expansion', 'refurbishment', 'refit', 'franchise', 'ai agent', 'software', 'platform', 'app', 'update'];
    if (negativeKeywords.some(kw => lower.includes(kw))) {
        return false;
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
        console.log(`\n=== Starting Sync for LinkedIn ONLY (Unifying News & LinkedIn) ===`);
        
        // 1. Google Sheets Auth
        const serviceAccountAuth = getGoogleAuth();
        const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();

        const linkedinSheet = doc.sheetsByTitle['LinkedIn'];

        if (!linkedinSheet) {
            console.error('LinkedIn sheet missing in Google Sheet! Please create it.');
            return;
        }

        const existingUrls = new Set((await linkedinSheet.getRows()).map(r => r.get('post url') || r.get('Post URL')));

        // 2. LinkedIn Data
        console.log('Fetching LinkedIn data from latest actor run...');
        const linkedinRuns = await client.actor('harvestapi/linkedin-post-search').runs().list({ desc: true, limit: 1 });
        const batchRows = [];
        
        if (linkedinRuns.items.length > 0) {
            const dataset = await client.run(linkedinRuns.items[0].id).dataset();
            const { items } = await dataset.listItems({ limit: 1000 });
            
            for (const item of items) {
                const url = item.linkedinUrl || item.url;
                if (!url || existingUrls.has(url)) continue;
                
                const text = item.content || item.text || '';
                const author = (item.author && item.author.name) || item.authorName || 'Unknown Author';
                
                // USER REQUEST: For grocers/retailers, only pull posts containing "new"
                const genericAuthors = [
                    'Retail Gazette', 'The Grocer', 'New Food Magazine', 'Trends', 'News', 'Media', 'Insight',
                    'Tesco', 'Sainsbury', 'Asda', 'Morrisons', 'Waitrose', 'Ocado', 'Boots', 'Superdrug', 'Sephora', 'Holland & Barrett'
                ];
                const isGenericAuthor = genericAuthors.some(ga => author.toLowerCase().includes(ga.toLowerCase()));
                
                if (isGenericAuthor && !text.toLowerCase().includes('new')) continue;
                
                // Extra relevance check: Must contain 'new' or a launch keyword
                const launchKeywords = ['launch', 'listing', 'shelf', 'shelves', 'stockist', 'range', 'available now', 'hitting', 'landed', 'introducing'];
                const isRelevant = text.toLowerCase().includes('new') || launchKeywords.some(kw => text.toLowerCase().includes(kw));
                
                if (!isRelevant) continue;

                const retailer = extractRetailer(text);
                const isLaunch = isProductLaunchLinkedin(text, retailer);
                const finalRetailer = (retailer === 'Unknown' && author.toLowerCase().includes('the grocer')) ? 'The Grocer' : retailer;

                // Better date extraction for LinkedIn
                let postDate = 'Unknown';
                if (item.postedAt) {
                    postDate = typeof item.postedAt === 'string' ? item.postedAt : (item.postedAt.date || item.postedAt.text || 'Unknown');
                } else if (item.date) {
                    postDate = item.date;
                } else if (item.timeRange) {
                    postDate = item.timeRange;
                }

                batchRows.push({
                    'id': item.id || '',
                    'brand': extractBrandLinkedin(text, author) || 'Unknown Brand',
                    'product': extractProductLinkedin(text) || 'Unknown Product',
                    'manufacturer': author,
                    'manufacturer url': (item.author && item.author.linkedinUrl) || item.authorUrl || '',
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
        }

        // 3. News Data (Syncing into same LinkedIn sheet)
        console.log('Fetching News data from latest actor run...');
        const newsRuns = await client.actor('apify/google-search-scraper').runs().list({ desc: true, limit: 1 });
        
        if (newsRuns.items.length > 0) {
            const dataset = await client.run(newsRuns.items[0].id).dataset();
            const { items } = await dataset.listItems();
            
            items.forEach((page) => {
                if (page.organicResults && Array.isArray(page.organicResults)) {
                    page.organicResults.forEach((result) => {
                        const url = result.url || result.displayedUrl;
                        if (!url || existingUrls.has(url)) return;

                        const textToAnalyze = `${result.title || ''} ${result.description || ''}`;
                        const retailer = extractRetailer(textToAnalyze);
                        
                        // For news, we only want "new" things
                        if (!textToAnalyze.toLowerCase().includes('new')) return;

                        const isLaunch = isProductLaunchLinkedin(textToAnalyze, retailer);
                        const source = extractSource(url);
                        
                        // Try to get a better product name for news - use the title if extract fails
                        let prodName = extractProductNews(textToAnalyze);
                        if (prodName === 'New Launch' || !prodName) {
                            // Take the first few words of the title as the product if it looks like a brand launch
                            const titleParts = result.title.split(':');
                            prodName = titleParts.length > 1 ? titleParts[1].trim() : result.title.substring(0, 40) + '...';
                        }

                        batchRows.push({
                            'id': '',
                            'brand': extractBrandNews(textToAnalyze),
                            'product': prodName,
                            'manufacturer': source,
                            'manufacturer url': url,
                            'date': extractDateNews(textToAnalyze) || 'Recent',
                            'retailer': retailer,
                            'type': isLaunch ? 'launch' : 'other',
                            'post snippet': `NEWS: ${result.title} - ${result.description}`.substring(0, 250),
                            'dealtWith': 'FALSE',
                            'post url': url,
                            'scrape_timestamp': new Date().toISOString()
                        });
                        existingUrls.add(url);
                    });
                }
            });
        }

        // 4. Save to Sheets
        if (batchRows.length > 0) {
            console.log(`Adding ${batchRows.length} total new rows to LinkedIn sheet...`);
            await linkedinSheet.addRows(batchRows);
            console.log(`\nFinished sync.`);
        } else {
            console.log('No new items found to sync.');
        }

    } catch (e) {
        console.error('API Error:', e);
    }
}

syncNewsLinkedinToSheet();
