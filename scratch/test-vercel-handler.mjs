import handler from '../api/run-scrape.js';

const mockRequest = {
    method: 'POST',
    body: {
        retailers: ['Tesco'],
        workspace: 'grocery'
    },
    headers: {
        host: 'localhost'
    }
};

const mockResponse = {
    status: (code) => {
        console.log('Status:', code);
        return mockResponse;
    },
    json: (data) => {
        console.log('JSON:', JSON.stringify(data, null, 2));
        return mockResponse;
    },
    send: (data) => {
        console.log('Send:', data);
        return mockResponse;
    }
};

async function test() {
    process.env.APIFY_TOKEN = 'mock'; 
    try {
        await handler(mockRequest, mockResponse);
    } catch (e) {
        console.error('CRASH:', e);
    }
}

test();
