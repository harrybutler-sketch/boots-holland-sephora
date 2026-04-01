import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const client = new ApifyClient({ token: APIFY_TOKEN });

async function checkActorDetails() {
    const actorId = 'YJCnS9qogi9XxDgLB';
    console.log(`Checking details for actor ${actorId}...`);
    
    try {
        const actor = await client.actor(actorId).get();
        console.log('Actor details:', JSON.stringify(actor, null, 2));
    } catch (e) {
        console.log('Actor not found by ID, checking tasks...');
        const tasks = await client.tasks().list();
        const task = tasks.items.find(t => t.id === actorId);
        if (task) {
            console.log('Task details:', JSON.stringify(task, null, 2));
        } else {
            console.log('Not found as task either.');
        }
    }
}

checkActorDetails().catch(console.error);
