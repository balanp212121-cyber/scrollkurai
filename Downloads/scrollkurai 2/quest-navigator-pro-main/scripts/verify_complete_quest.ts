import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';

// Load env vars
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

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    console.error('Missing env vars');
    process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
const authClient = createClient(SUPABASE_URL, ANON_KEY);

async function run() {
    console.log('--- COMPLETE QUEST VERIFICATION ---');

    // 1. Get/Create Test User
    const email = 'quest_test@test.com';
    const password = 'password123';
    let userId = '';

    const { data: users } = await adminClient.auth.admin.listUsers();
    const existing = users?.users.find(u => u.email === email);

    if (!existing) {
        console.log('Creating test user...');
        const { data, error } = await adminClient.auth.admin.createUser({
            email, password, email_confirm: true
        });
        if (error) { console.error('Create user error:', error); return; }
        userId = data.user.id;
    } else {
        userId = existing.id;
    }
    console.log(`User ID: ${userId}`);

    // 2. Login
    const { data: { session }, error: loginError } = await authClient.auth.signInWithPassword({
        email, password
    });
    if (loginError) { console.error('Login error:', loginError); return; }
    console.log('Logged in.');

    // 3. Invoke get-daily-quest to get a quest log
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    console.log(`Getting quest for date: ${today}`);

    const getQuestRes = await fetch(`${SUPABASE_URL}/functions/v1/get-daily-quest`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ date: today })
    });

    if (!getQuestRes.ok) {
        console.error(`Get quest failed: ${getQuestRes.status}`, await getQuestRes.text());
        return;
    }

    const questData = await getQuestRes.json();
    console.log('Quest Data:', questData);

    if (!questData.log_id) {
        console.error('No log_id returned from get-daily-quest!');
        return;
    }

    // 4. Check if already completed
    const { data: existingLog } = await adminClient
        .from('user_quest_log')
        .select('completed_at')
        .eq('id', questData.log_id)
        .single();

    if (existingLog?.completed_at) {
        console.log('Quest already completed. Resetting for test...');
        await adminClient.from('user_quest_log').update({
            completed_at: null,
            reflection_text: null,
            xp_awarded: null
        }).eq('id', questData.log_id);
        console.log('Quest reset.');
    }

    // 5. Complete quest
    console.log(`Completing quest log_id: ${questData.log_id}`);

    const completeRes = await fetch(`${SUPABASE_URL}/functions/v1/complete-quest`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            log_id: questData.log_id,
            reflection_text: 'This is a test reflection for the verification script. It is at least 15 characters.',
            is_golden_quest: false
        })
    });

    const completeStatus = completeRes.status;
    const completeBody = await completeRes.text();

    console.log(`Complete Status: ${completeStatus}`);
    console.log(`Complete Body: ${completeBody}`);

    if (completeStatus === 200) {
        const result = JSON.parse(completeBody);
        if (result.success) {
            console.log('\n✅ COMPLETE QUEST VERIFIED');
            console.log(`   XP Awarded: ${result.xp_awarded}`);
            console.log(`   Streak: ${result.streak}`);
            console.log(`   Level: ${result.level}`);
        } else {
            console.error('❌ FAILED: Response was 200 but success=false');
        }
    } else {
        console.error(`❌ FAILED: Status ${completeStatus}`);
        console.error(`   Body: ${completeBody}`);
    }

    console.log('\n--- VERIFICATION COMPLETE ---');
}

run();
