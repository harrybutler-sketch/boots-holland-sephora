import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const resultsFunction = require('./netlify/functions/results.js');
import dotenv from 'dotenv';
dotenv.config();

async function testEndpoint() {
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY.replace(/\\n/g, '\n');

    console.log('Testing results.js handler...');

    // Simulate the request from the user's screenshot
    const event = {
        httpMethod: 'GET',
        queryStringParameters: {
            retailer: 'All',
            days: '28',
            q: '',
            review_range: '0-5',
            workspace: 'beauty'
        }
    };

    try {
        const response = await resultsFunction.handler(event, {});
        console.log(`Status Code: ${response.statusCode}`);

        if (response.statusCode === 200) {
            const body = JSON.parse(response.body);
            console.log(`Returned Items: ${body.length}`);

            // Check for Glow Recipe
            const glowRecipe = body.find(i => i.product_name && i.product_name.includes('PDRN+'));
            if (glowRecipe) {
                console.log('❌ FAIL: Glow Recipe (192 reviews) found in response!');
                console.log('Item:', glowRecipe);
            } else {
                console.log('✅ PASS: Glow Recipe not found in response.');
            }

            // Check headers
            console.log('Headers:', response.headers);
        } else {
            console.log('Error Body:', response.body);
        }

    } catch (error) {
        console.error('Handler execution failed:', error);
    }
}

testEndpoint();
