import handler from './api/results.js';
import dotenv from 'dotenv';
dotenv.config();

async function testFilter() {
    console.log('Testing api/results.js with hide_dealt=true...');
    
    // Mock request and response
    const req = {
        method: 'GET',
        query: {
            limit: '5',
            workspace: 'beauty',
            hide_dealt: 'true'
        }
    };
    
    const res = {
        status: (code) => {
            console.log('Status Code:', code);
            return res;
        },
        json: (data) => {
            console.log('Results Count (hide_dealt=true):', data.length);
            const dealtItems = data.filter(item => item.status === 'Dealt With');
            console.log('Dealt Items Found:', dealtItems.length);
            if (dealtItems.length === 0) {
                console.log('✅ Success: No dealt items found when hide_dealt=true');
            } else {
                console.error('❌ Failure: Dealt items found despite hide_dealt=true');
            }
            return res;
        },
        setHeader: () => {}
    };

    try {
        await handler(req, res);
        
        console.log('\nTesting api/results.js with hide_dealt=false...');
        req.query.hide_dealt = 'false';
        res.json = (data) => {
            console.log('Results Count (hide_dealt=false):', data.length);
            const dealtItems = data.filter(item => item.status === 'Dealt With');
            console.log('Dealt Items Found:', dealtItems.length);
            return res;
        };
        await handler(req, res);
        
    } catch (error) {
        console.error('Test Error:', error);
    }
}

testFilter();
