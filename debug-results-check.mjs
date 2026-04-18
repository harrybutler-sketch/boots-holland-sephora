import handler from './api/results.js';
import dotenv from 'dotenv';
dotenv.config();

const mockRequest = {
    method: 'GET',
    query: {
        retailer: 'Sephora',
        workspace: 'beauty',
        days: '60'
    }
};

const mockResponse = {
    status: (code) => {
        console.log('Status:', code);
        return mockResponse;
    },
    json: (data) => {
        console.log('Results Count:', data.length);
        if (data.length > 0) {
            console.log('First Item:', JSON.stringify(data[0], null, 2));
            const hbItems = data.filter(i => i.retailer.startsWith('Holland'));
            console.log('Holland Items Found:', hbItems.length);
        }
        return mockResponse;
    },
    setHeader: () => {}
};

async function test() {
    try {
        console.log('Testing results retrieval for Holland & Barrett...');
        await handler(mockRequest, mockResponse);
    } catch (e) {
        console.warn('Execution note (expected token error if run locally):', e.message);
    }
}

test();
