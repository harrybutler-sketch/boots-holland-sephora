
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

async function listRecentRuns() {
    try {
        console.log('Fetching last 5 runs...');
        const runs = await client.runs().list({ limit: 5, desc: true });

        for (const run of runs.items) {
            console.log(`\n--------------------------------------------------`);
            console.log(`Run ID: ${run.id} | Status: ${run.status} | Created: ${run.startedAt}`);

            const inputRecord = await client.keyValueStore(run.defaultKeyValueStoreId).getRecord('INPUT');
            if (inputRecord && inputRecord.value) {
                const input = inputRecord.value;
                const urls = input.startUrls || input.listingUrls || [];

                // Extract retailers
                const retailers = urls.map(u => u.userData ? u.userData.retailer : 'Unknown');
                console.log('Retailers:', retailers.join(', '));

                // Check Sainsbury's specifically
                const sainsburys = urls.find(u => u.userData && u.userData.retailer === 'Sainsburys');
                if (sainsburys) {
                    console.log('✅ SAINSBURY FOUND!');
                    console.log('URL:', sainsburys.url);
                } else {
                    console.log('❌ Sainsbury NOT in input.');
                }

                console.log('Scrape Mode:', input.scrapeMode);
            } else {
                console.log('No input record found.');
            }
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

listRecentRuns();
