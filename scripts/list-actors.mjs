import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
dotenv.config();

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

async function listActors() {
    console.log('Listing all actors...');
    const actors = await client.actors().list();
    actors.items.forEach(actor => {
        console.log(`ID: ${actor.id} | Name: ${actor.name} | Created: ${actor.createdAt}`);
    });
}

listActors();
