import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const client = new ApifyClient({ token: APIFY_TOKEN });

async function listTasks() {
    console.log('Listing all tasks...');
    const tasks = await client.tasks().list();
    for (const task of tasks.items) {
        console.log(`- Task: ${task.name} | ID: ${task.id} | Actor: ${task.actId}`);
    }
}

listTasks().catch(console.error);
