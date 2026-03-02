import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

async function listTasks() {
    console.log('Listing all tasks...');
    const tasks = await client.tasks().list();
    tasks.items.forEach(task => {
        console.log(`ID: ${task.id} | Name: ${task.name} | ActorId: ${task.actorId}`);
    });
}

listTasks();
