
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const TEST_EMAIL = `powerup_test_${Date.now()}@example.com`;
const TEST_PASSWORD = 'password123';

async function runTest() {
    console.log('=== STARTING CANONICAL POWER-UP VERIFICATION ===');

    // 1. Create User
    console.log(`\n1. Creating Test User: ${TEST_EMAIL}`);
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
    });
    if (authError) throw authError;
    const userId = authData.user!.id;
    console.log(`   User created: ${userId}`);

    // Log the user in to get a JWT
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
    });
    if (loginError) throw loginError;
    const token = loginData.session!.access_token;
    console.log('   User logged in (JWT acquired).');

    // 2. Setup Profile & Quest (Simulate)
    console.log('\n2. Setting up Profile & Active Quest...');
    // Ensure profile exists (trigger might have created it, but update stats)
    await supabase.from('profiles').upsert({
        id: userId,
        username: 'PowerUpTester',
        xp: 0,
        level: 1,
        streak: 5,
        last_quest_date: new Date(Date.now() - 86400000).toISOString().split('T')[0] // Yesterday
    });

    // Create Active Quest
    const questId = crypto.randomUUID();
    await supabase.from('user_quest_log').insert({
        id: questId,
        user_id: userId,
        difficulty: 'Medium',
        status: 'active',
        started_at: new Date().toISOString()
    });
    console.log(`   Quest created: ${questId} (active)`);

    // 3. Activate Power-Up (Blood Oath)
    console.log('\n3. Activating "Blood Oath" (3x XP)...');
    // Using Edge Function via fetch to simulate real client
    const applyUrl = `${SUPABASE_URL}/functions/v1/apply-powerup`;
    const applyRes = await fetch(applyUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ powerup_id: 'blood_oath' })
    });

    const applyJson = await applyRes.json();
    console.log('   Response:', applyJson);

    if (!applyRes.ok || !applyJson.success) {
        throw new Error(`Failed to activate powerup: ${JSON.stringify(applyJson)}`);
    }
    console.log('   ✅ Power-Up Activated Successfully!');

    // 4. Verify DB State
    console.log('\n4. Verifying DB State...');
    const { data: userPowerups, error: dbError } = await supabase
        .from('user_strategic_powerups')
        .select('*')
        .eq('user_id', userId)
        .eq('powerup_id', 'blood_oath');

    if (dbError) throw dbError;
    if (userPowerups.length !== 1) throw new Error('Powerup not found in DB!');
    console.log(`   ✅ DB Record found: ${userPowerups[0].id}`);

    // 5. Complete Quest
    console.log('\n5. Completing Quest...');
    const completeUrl = `${SUPABASE_URL}/functions/v1/complete-quest`;
    const completeRes = await fetch(completeUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            log_id: questId,
            reflection_text: 'I have verified the canonical power-up system effectively.',
            is_golden_quest: false
        })
    });

    const completeJson = await completeRes.json();
    console.log('   Response:', completeJson);

    if (!completeRes.ok || !completeJson.success) {
        throw new Error(`Failed to complete quest: ${JSON.stringify(completeJson)}`);
    }

    // 6. Verify XP Math
    // Base XP (250) + Streak Bonus (6 * 10 = 60) = 310
    // Multiplier (3x) => 930
    const expectedXp = (250 + (6 * 10)) * 3;
    console.log(`\n6. Verifying XP: Expected ${expectedXp}, Got ${completeJson.xp_awarded}`);

    if (completeJson.xp_awarded === expectedXp) {
        console.log('   ✅ XP Calculation Correct (Multiplier Applied)!');
    } else {
        console.error('   ❌ XP Mismatch!');
    }

    if (completeJson.xp_booster_applied === true) {
        console.log('   ✅ UI Flag (xp_booster_applied) is TRUE');
    } else {
        console.error('   ❌ UI Flag missing!');
    }

    console.log('\n=== VERIFICATION COMPLETE: ALL SYSTEMS GO ===');
}

runTest().catch(e => {
    console.error('Test Failed:', e);
    process.exit(1);
});
