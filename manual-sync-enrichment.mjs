import dotenv from 'dotenv';
dotenv.config();

console.log('Environment Check:', {
    hasEmail: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    hasKey: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY
});

import handler from './api/run-status.js';

const req = {
    method: 'POST',
    headers: {
        host: 'localhost:3000',
        'x-forwarded-proto': 'http'
    },
    query: {
        workspace: 'beauty'
    },
    body: {
        userId: "simulation",
        createdAt: new Date().toISOString(),
        eventType: "ACTOR.RUN.SUCCEEDED",
        eventData: {
            actorId: "apify/puppeteer-scraper",
            actorRunId: "oQKraSE2fwpuYfM2R"
        },
        resource: {
            defaultDatasetId: "0YYiDFrovgbZwc19Q"
        }
    }
};

const res = {
    status: (code) => ({
        json: (data) => console.log('Response JSON:', code, JSON.stringify(data, null, 2)),
        send: (msg) => console.log('Response Text:', code, msg)
    }),
    json: (data) => console.log('Response JSON:', 200, JSON.stringify(data, null, 2)),
    send: (msg) => console.log('Response Text:', 200, msg)
};

console.log('Triggering manual enrichment sync...');
await handler(req, res);
