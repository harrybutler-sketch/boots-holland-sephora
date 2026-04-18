import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

async function triggerTask() {
    console.log('Triggering Sainsbury\'s Task (ExvM2md70ITCHEHci) with URL overrides...');
    const targetUrls = [
        'https://www.sainsburys.co.uk/gol-ui/features/new-in-chilled/opt/page:2'
    ];

    try {
        const run = await client.task('ExvM2md70ITCHEHci').start({
            startUrls: targetUrls.map(url => ({ url }))
        });

        console.log(`Task Run started: ${run.id}`);
        console.log(`View progress: https://console.apify.com/actors/tasks/ExvM2md70ITCHEHci/runs/${run.id}`);
    } catch (error) {
        console.error('Task Trigger failed:', error);
    }
}

triggerTask();
