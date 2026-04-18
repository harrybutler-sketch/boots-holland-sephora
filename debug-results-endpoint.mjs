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
            workspace: 'beauty',
            days: '28',
            limit: '200',
            retailer: 'All'
        }
    };
    
    console.log("Simulating Frontend Call to /results with 'All'...");
    let response = await handler(event, {});
    let body = JSON.parse(response.body);
    console.log(`With retailer=All: Found ${body.length || body.error || 0} products`);
    if(body.length > 0) console.log(body[0]);

    event.queryStringParameters.retailer = 'All Retailers';
    console.log("\nSimulating Frontend Call to /results with 'All Retailers'...");
    response = await handler(event, {});
    body = JSON.parse(response.body);
    console.log(`With retailer=All Retailers: Found ${body.length || body.error || 0} products`);
    
    event.queryStringParameters.retailer = undefined;
    console.log("\nSimulating Frontend Call to /results without retailer...");
    response = await handler(event, {});
    body = JSON.parse(response.body);
    console.log(`With no retailer param: Found ${body.length || body.error || 0} products`);
}

testFrontendCall().catch(console.error);
