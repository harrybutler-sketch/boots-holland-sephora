import { ApifyClient } from 'apify-client';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import dotenv from 'dotenv';
import { getGoogleAuth } from './lib/google-auth.js';

dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

async function debug() {
    const serviceAccountAuth = getGoogleAuth();
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();

    const linkedinSheet = doc.sheetsByTitle['LinkedIn'];
    const existingUrls = new Set((await linkedinSheet.getRows()).map(r => r.get('post url') || r.get('Post URL')));
    console.log(`Loaded ${existingUrls.size} existing URLs from LinkedIn sheet.`);

    console.log('Fetching LinkedIn runs...');
    const linkedinRuns = await client.actor('harvestapi/linkedin-post-search').runs().list({ desc: true, limit: 1 });
    const dataset = await client.run(linkedinRuns.items[0].id).dataset();
    const { items } = await dataset.listItems({ limit: 1000 });
    
    let passed = 0;
    let failedGeneric = 0;
    let failedRelevance = 0;
    let failedNoUrl = 0;
    let failedDuplicate = 0;

    for (const item of items) {
        const url = item.linkedinUrl || item.url;
        if (!url) {
            failedNoUrl++;
            continue;
        }
        
        if (existingUrls.has(url)) {
            failedDuplicate++;
            continue;
        }
        
        const text = item.content || item.text || '';
        const author = (item.author && item.author.name) || item.authorName || 'Unknown Author';
        
        const genericAuthors = [
            'Retail Gazette', 'The Grocer', 'New Food Magazine', 'Trends', 'News', 'Media', 'Insight',
            'Tesco', 'Sainsbury', 'Asda', 'Morrisons', 'Waitrose', 'Ocado', 'Boots', 'Superdrug', 'Sephora', 'Holland & Barrett'
        ];
        const isGenericAuthor = genericAuthors.some(ga => author.toLowerCase().includes(ga.toLowerCase()));
        
        if (isGenericAuthor && !text.toLowerCase().includes('new')) {
            failedGeneric++;
            continue;
        }
        
        const launchKeywords = [
            'launch', 'listing', 'shelf', 'shelves', 'stockist', 
            'range', 'available now', 'hitting', 'landed', 'introducing',
            'new SKU', 'new flavor', 'new flavour', 'new variant', 'new scent'
        ];
        
        const lowerText = text.toLowerCase();
        const isRelevant = lowerText.includes('new product') || 
                            lowerText.includes('new launch') ||
                            launchKeywords.some(kw => lowerText.includes(kw.toLowerCase()));
        
        if (!isRelevant) {
            failedRelevance++;
            continue;
        }
        
        passed++;
    }

    console.log(`\nDEBUG SUMMARY:`);
    console.log(`Total URLs: ${items.length}`);
    console.log(`Failed (No URL): ${failedNoUrl}`);
    console.log(`Failed (Already in Google Sheet): ${failedDuplicate}`);
    console.log(`Failed (Generic Author w/o "new"): ${failedGeneric}`);
    console.log(`Failed (Strict Relevance Keyword): ${failedRelevance}`);
    console.log(`Passed Filters and Ready to Insert: ${passed}`);
}

debug().catch(console.error);
