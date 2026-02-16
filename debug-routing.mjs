
import handler from './api/run-scrape.js';

const mockReq = {
    method: 'POST',
    body: {
        retailers: ['Sainsburys'],
        workspace: 'grocery'
    },
    headers: {
        host: 'localhost'
    }
};

const mockRes = {
    status: (code) => {
        console.log('Response Code:', code);
        return {
            json: (data) => console.log('Response Data:', JSON.stringify(data, null, 2)),
            send: (msg) => console.log('Response Msg:', msg)
        };
    }
};

console.log('Testing api/run-scrape.js routing logic...');
try {
    await handler(mockReq, mockRes);
} catch (e) {
    console.error('Execution failed:', e);
}
