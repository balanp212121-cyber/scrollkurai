import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
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
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || envConfig['VITE_SUPABASE_PUBLISHABLE_KEY'];
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || envConfig['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    console.error('Missing env vars');
    process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
const authClient = createClient(SUPABASE_URL, ANON_KEY);

async function runTest() {
    console.log('--- STARTING AI LIMIT VERIFICATION ---');

    // 1. Authenticate Test User (using same credentials as other tests)
    const email = 'testuser@example.com';
    const password = 'password123';

    // Ensure user exists (admin)
    let userId = '';
    const { data: users } = await adminClient.auth.admin.listUsers();
    const existing = users?.users.find(u => u.email === email);

    if (!existing) {
        console.log('Creating test user...');
        const { data, error } = await adminClient.auth.admin.createUser({
            email, password, email_confirm: true
        });
        if (error) throw error;
        userId = data.user.id;
    } else {
        userId = existing.id;
    }

    console.log(`Test User ID: ${userId}`);

    // Ensure Premium (to bypass premium check)
    await adminClient.from('profiles').update({ premium_status: true }).eq('id', userId);

    // Login
    const { data: { session }, error: loginError } = await authClient.auth.signInWithPassword({
        email, password
    });
    if (loginError) throw loginError;

    // 2. RESET USAGE for today (IST)
    const nowIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    console.log(`Resetting usage for date: ${nowIST}`);

    const { error: deleteError } = await adminClient
        .from('ai_daily_usage')
        .delete()
        .eq('user_id', userId)
        .eq('usage_date', nowIST);

    if (deleteError) console.error('Reset error:', deleteError);
    else console.log('Usage reset successful.');

    // 3. TEST LOOP
    const token = session?.access_token;

    // Function URL
    const functionUrl = `${SUPABASE_URL}/functions/v1/generate-with-gemini`; // Using this one as it's cleaner to test via POST

    for (let i = 1; i <= 3; i++) {
        console.log(`\nAttempt ${i}...`);

        try {
            const res = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt: 'Say hello' })
            });

            console.log(`Status: ${res.status}`);
            const text = await res.text();

            if (i <= 2) {
                if (res.status === 200) console.log('✅ Success (Expected)');
                else console.error(`❌ FAILED: Expected 200, got ${res.status}. Body: ${text}`);
            } else {
                if (res.status === 429) console.log('✅ BLOCKED (Expected)');
                else console.error(`❌ FAILED: Expected 429, got ${res.status}. Body: ${text}`);
            }

        } catch (e) {
            console.error('Fetch error:', e);
        }
    }

    console.log('\n--- VERIFICATION COMPLETE ---');
}

runTest();
