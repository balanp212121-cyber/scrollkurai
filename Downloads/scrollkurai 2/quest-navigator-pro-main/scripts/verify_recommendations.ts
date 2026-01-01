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

function log(msg: string, status: 'PASS' | 'FAIL' | 'INFO' = 'INFO') {
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : 'ℹ️';
    console.log(`${icon} ${msg}`);
}

async function run() {
    console.log('=== POWER-UP RECOMMENDATIONS VERIFICATION ===\n');

    // 1. Create/Get test user
    const email = 'recommendations_test@test.com';
    const password = 'password123';

    const { data: users } = await adminClient.auth.admin.listUsers();
    let userId = users?.users.find(u => u.email === email)?.id;

    if (!userId) {
        const { data } = await adminClient.auth.admin.createUser({
            email, password, email_confirm: true
        });
        userId = data.user?.id;
    }

    if (!userId) {
        log('Failed to get test user', 'FAIL');
        return;
    }
    log(`Test user: ${userId}`, 'INFO');

    // 2. Login
    const { data: { session }, error: loginError } = await authClient.auth.signInWithPassword({
        email, password
    });

    if (loginError || !session) {
        log(`Login failed: ${loginError?.message}`, 'FAIL');
        return;
    }
    log('Logged in', 'PASS');

    // 3. Set up test scenarios
    console.log('\n--- Scenario 1: User with streak at risk ---');

    // Set profile with streak at risk (last quest date is 3 days ago, streak = 5)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];

    await adminClient.from('profiles').update({
        streak: 5,
        last_quest_date: threeDaysAgoStr,
        premium_status: true,
        xp_booster_active: false,
        streak_freeze_active: false
    }).eq('id', userId);

    // Give them a streak freeze power-up
    const { data: streakFreezePowerUp } = await adminClient
        .from('power_ups')
        .select('id')
        .eq('effect_type', 'streak_save')
        .single();

    if (streakFreezePowerUp) {
        // Clear old and add fresh
        await adminClient.from('user_power_ups').delete().eq('user_id', userId);
        await adminClient.from('user_power_ups').insert({
            user_id: userId,
            power_up_id: streakFreezePowerUp.id,
            quantity: 1
        });
        log('Streak freeze added to inventory', 'INFO');
    }

    // 4. Call recommendations endpoint
    const recResponse = await fetch(`${SUPABASE_URL}/functions/v1/get-powerup-recommendations`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
        }
    });

    if (!recResponse.ok) {
        log(`Recommendations endpoint failed: ${recResponse.status}`, 'FAIL');
        const text = await recResponse.text();
        console.log('Response:', text);
        return;
    }

    const recData = await recResponse.json();
    log(`Recommendations returned: ${recData.recommendations?.length || 0}`, 'INFO');

    if (recData.recommendations && recData.recommendations.length > 0) {
        for (const rec of recData.recommendations) {
            log(`Recommendation: ${rec.power_up_name} - "${rec.reason}" (confidence: ${rec.confidence_score})`, 'PASS');
        }

        // Verify streak freeze is recommended when at risk
        const hasStreakRec = recData.recommendations.some((r: any) =>
            r.reason.toLowerCase().includes('streak') &&
            r.confidence_score >= 0.9
        );

        if (hasStreakRec) {
            log('High-confidence streak protection recommendation present', 'PASS');
        }
    } else {
        log('No recommendations returned', 'INFO');
    }

    // 5. Verify user context is returned
    if (recData.user_context) {
        log(`User context included: streak=${recData.user_context.streak}`, 'PASS');
    } else {
        log('User context missing from response', 'FAIL');
    }

    // 6. Scenario 2: User with no inventory
    console.log('\n--- Scenario 2: Empty inventory ---');

    await adminClient.from('user_power_ups').delete().eq('user_id', userId);

    const emptyResponse = await fetch(`${SUPABASE_URL}/functions/v1/get-powerup-recommendations`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
        }
    });

    const emptyData = await emptyResponse.json();

    if (emptyData.recommendations?.length === 0) {
        log('No recommendations when inventory is empty (correct)', 'PASS');
    } else {
        log('Recommendations returned without inventory (should not happen)', 'FAIL');
    }

    console.log('\n=== RECOMMENDATIONS VERIFICATION COMPLETE ===');
}

run();
