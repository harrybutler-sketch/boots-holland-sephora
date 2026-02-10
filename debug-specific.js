
import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

async function analyzeRun() {
    try {
        const runId = 'IynEeZnUAaB2PtLrV';
        console.log(`Analyzing Run: ${runId}`);

        const dataset = await client.run(runId).dataset();
        const { items } = await dataset.listItems();
        console.log(`Item Count: ${items.length}`);

        if (items.length === 0) {
            console.log('Fetching log to see why 0 items...');
            const log = await client.log(runId).get();
            const relevantLines = log.split('\n').filter(line =>
                line.includes('WARN') ||
                line.includes('ERROR') ||
                line.includes('Retrying') ||
                line.includes('Sainsburys')
            );
            console.log(relevantLines.join('\n'));
        } else {
            console.log('Success! Sample item:', items[0].productName || items[0].title);
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

analyzeRun();
