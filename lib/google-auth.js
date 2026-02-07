import { JWT } from 'google-auth-library';

export function getGoogleAuth() {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

    if (!email || !key) {
        throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_KEY');
    }

    // cleaning key
    // 1. Remove outer quotes if present
    if (key.startsWith('"') && key.endsWith('"')) {
        key = key.slice(1, -1);
    }

    // 2. Handle escaped newlines (common in Vercel/Env vars)
    key = key.replace(/\\n/g, '\n');

    return new JWT({
        email,
        key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
}
