import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

// Load env
const envPath = path.resolve(process.cwd(), '.env');
const envConfig = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, 'utf-8').split('\n').reduce((acc, line) => {
        const [key, ...value] = line.split('=');
        if (key && value) acc[key.trim()] = value.join('=').trim();
        return acc;
    }, {} as Record<string, string>)
    : {};

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || envConfig['VITE_SUPABASE_URL'];
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || envConfig['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Missing env vars');
    process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

async function testRpc() {
    console.log('--- TESTING RPC DIRECTLY ---');

    // Create a random user ID for testing (doesn't need to exist in auth.users per se if we didn't add FK? 
    // Wait, the table definition has: user_id UUID NOT NULL REFERENCES auth.users(id)
    // So we need a real user.
    // Let's list users.
    const { data: users } = await adminClient.auth.admin.listUsers();
    const user = users?.users[0];

    if (!user) {
        console.error('No users found to test with.');
        return;
    }

    const userId = user.id;
    const nowIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    console.log(`Calling increment_ai_usage for User: ${userId}, Date: ${nowIST}`);

    const { data, error } = await adminClient
        .rpc('increment_ai_usage', { p_user_id: userId, p_date: nowIST });

    if (error) {
        console.error('RPC ERROR:', JSON.stringify(error, null, 2));
    } else {
        console.log('RPC SUCCESS. Count:', data);
    }
}

testRpc();
