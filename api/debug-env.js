export default function handler(request, response) {
    const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const sheetId = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

    const debugInfo = {
        email_exists: !!email,
        key_exists: !!key,
        key_length: key ? key.length : 0,
        key_start: key ? key.substring(0, 30) : 'N/A',
        key_end: key ? key.substring(key.length - 30) : 'N/A',
        key_has_newlines: key ? key.includes('\n') : false,
        key_has_escaped_newlines: key ? key.includes('\\n') : false,
        sheet_id_exists: !!sheetId
    };

    return response.status(200).json(debugInfo);
}
