import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();
const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
const runId = '26uPrb7KWd0moWUnK';
try {
    const log = await client.run(runId).log().get();
    console.log(log.substring(log.length - 2000)); // Show last 2000 chars
} catch (e) {
    console.error(e);
}
