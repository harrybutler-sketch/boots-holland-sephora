import linkedinResults from './netlify/functions/linkedin-results.js';
import dotenv from 'dotenv';
dotenv.config();

async function testLinkedinApi() {
    console.log('--- Testing LinkedIn API Logic (with Env) ---');
    try {
        const req = {}; 
        const context = {}; 
        const response = await linkedinResults(req, context);
        const data = await response.json();
        
        console.log(`API returned ${data.length} items from the last 28 days.`);
        
        if (data.length > 0) {
            console.log('\nTop 3 items provided to Dashboard:');
            data.slice(0, 3).forEach(item => {
                console.log(`- [${item.date}] ${item.manufacturer}: ${item.product} (${item.retailer})`);
            });
        }
    } catch (error) {
        console.error('Error testing API:', error);
    }
}

testLinkedinApi();
