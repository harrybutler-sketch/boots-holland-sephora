
import handler from './api/run-status.js';
import dotenv from 'dotenv';
dotenv.config();

async function testHandler() {
    const mockRequest = {
        method: 'GET',
        query: { runId: 'KmVbA0OVNR82JmYjg' } // Using a known good run ID
    };

    const mockResponse = {
        status: function (code) {
            console.log('Status Code:', code);
            return this;
        },
        json: function (data) {
            console.log('Response JSON:', JSON.stringify(data, null, 2));
            return this;
        },
        send: function (msg) {
            console.log('Response Send:', msg);
            return this;
        },
        setHeader: function (name, value) {
            console.log('Header:', name, value);
        }
    };

    console.log('Running handler test...');
    try {
        await handler(mockRequest, mockResponse);
    } catch (e) {
        console.error('Handler crashed:', e);
    }
}

testHandler();
