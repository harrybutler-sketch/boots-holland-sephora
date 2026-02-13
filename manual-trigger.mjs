import handler from './api/run-scrape.js';

const req = {
    method: 'POST',
    headers: {
        host: 'brand-allies-scraper-psi.vercel.app',
        'x-forwarded-proto': 'https'
    },
    body: {
        retailers: ['Holland & Barrett'],
        workspace: 'beauty'
    }
};

const res = {
    status: (code) => ({
        json: (data) => console.log('Response:', code, data),
        send: (msg) => console.log('Response:', code, msg)
    })
};

console.log('Triggering manual scrape...');
handler(req, res);
