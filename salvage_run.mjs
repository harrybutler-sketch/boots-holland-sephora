import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

async function salvageRun() {
    const runId = 'RmDyrn2XfPIlhoQVe'; // The timed-out run
    console.log(`Salvaging data from run ${runId}...`);

    // 1. Fetch all items
    const { items } = await client.run(runId).dataset().listItems();
    console.log(`Found ${items.length} total items`);

    // 2. Filter items (The E-commerce actor might not return review counts reliably in listing mode)
    // We will assume "New In" items are low reviews, or just take the first 50 to be safe and cost-effective
    // The user wants "max 5 reviews", but if we don't have review data, we can't filter yet.
    // However, the enrichment phase (puppeteer) WILL get the review count.
    // So we should send them to enrichment, but maybe limit the number to avoid massive costs?
    // Let's take the first 100 items.

    const productsToEnrich = items.slice(0, 50).map(item => {
        return {
            url: item.url,
            userData: {
                ...item,
                label: 'DETAIL',
                retailer: 'Holland & Barrett' // Hardcoded for this test salvage
            }
        };
    });

    console.log(`Saving ${productsToEnrich.length} items to a new dataset for enrichment...`);

    // 3. Trigger Enrichment Manually (Reuse code from run-enrichment.js logic)
    // Actually, run-enrichment.js expects a discoveryRunId. 
    // If I just call the /api/run-enrichment endpoint with the runID, it will fetch ALL items.
    // I should probably FILTER them first, but run-enrichment doesn't have a filter logic implemented yet?
    // Let's check run-enrichment.js content first?

    // START DIRECT APY CALL
    const enrichmentRun = await client.actor('apify/puppeteer-scraper').start({
        startUrls: productsToEnrich,
        proxyConfiguration: { useApifyProxy: true },
        maxPagesPerCrawl: productsToEnrich.length + 10,
        pageFunction: `async function pageFunction(context) {
    const { page, request, log } = context;
    const { userData } = request;
    
    log.info(\`Processing \${request.url}\`);
    
    // Wait for common review widgets
    try {
        await page.waitForTimeout(5000); 
    } catch (e) {}

    // Extract Data
    const title = await page.title();
    
    // Universal Review Extraction Strategy
    let reviewCount = 0;
    let ratingValue = 0;
    
    // Try generic selectors
    const textContent = await page.$eval('body', el => el.innerText).catch(() => '');
    const reviewsMatch = textContent.match(/(\\d+)\\s+reviews?/i);
    if (reviewsMatch) reviewCount = parseInt(reviewsMatch[1]);
    
    // Try schema
    const schemas = await page.$$eval('script[type="application/ld+json"]', scripts => 
        scripts.map(s => {
            try { return JSON.parse(s.innerText); } catch (e) { return null; }
        })
    );
    
    // Find review quantity in schema
    for (const schema of schemas) {
        if (schema && (schema['@type'] === 'Product' || schema['@type'] === 'AggregateRating')) {
            if (schema.aggregateRating) {
                reviewCount = schema.aggregateRating.reviewCount || reviewCount;
                ratingValue = schema.aggregateRating.ratingValue || ratingValue;
            }
        }
    }

    // Return Data
    return {
        ...userData,
        url: request.url,
        title,
        reviewCount,
        ratingValue,
        enriched: true
    };
}`,
    }, {
        webhooks: [
            {
                eventTypes: ['ACTOR.RUN.SUCCEEDED'],
                requestUrl: 'https://brand-allies-scraper-psi.vercel.app/api/run-status?workspace=beauty'
            }
        ]
    });

    console.log(`Enrichment started! Run ID: ${enrichmentRun.id}`);
}

salvageRun();
