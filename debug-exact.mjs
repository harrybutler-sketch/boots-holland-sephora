import { handler } from './netlify/functions/results.js';
import fs from 'fs';
import path from 'path';

// read env file
const envMap = {};
try {
    const envFile = fs.readFileSync(path.resolve('.env'), 'utf8');
    envFile.split('\n').filter(Boolean).forEach(line => {
        const idx = line.indexOf('=');
        if (idx > -1) {
            envMap[line.substring(0, idx)] = line.substring(idx + 1).replace(/^"|"$/g, '').replace(/^'|'$/g, '');
        }
    });
} catch(e) {}

process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || envMap.GOOGLE_SERVICE_ACCOUNT_EMAIL;
let key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || envMap.GOOGLE_SERVICE_ACCOUNT_KEY;
if (key) process.env.GOOGLE_SERVICE_ACCOUNT_KEY = key.replace(/\\n/g, '\n');
process.env.GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID || envMap.GOOGLE_SHEET_ID;

async function testFrontendCall() {
    const event = {
        httpMethod: 'GET',
        queryStringParameters: {
            limit: '5000',
            retailer: 'Holland & Barrett',
            days: '28',
            q: '',
            review_range: '',
            hide_dealt: 'true',
            workspace: 'beauty'
        }
    };
    
    console.log("Simulating string parameters precisely...");
    let response = await handler(event, {});
    let body = JSON.parse(response.body);
    console.log(`Length: ${body.length}`);
}

testFrontendCall().catch(console.error);
