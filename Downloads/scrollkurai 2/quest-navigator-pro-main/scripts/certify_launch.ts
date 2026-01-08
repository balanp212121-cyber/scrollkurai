
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load env
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ CRITICAL: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}
console.log('Project URL:', SUPABASE_URL);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
// Use a unique email to avoid collision if running multiple times
const TEST_EMAIL = `launch_cert_${Date.now()}@example.com`;
const TEST_PASSWORD = 'certifypassword123';

async function certify() {
    console.log('\n🚀 STARTING LAUNCH CERTIFICATION PROTOCOL 🚀\n');
    let checksPassed = 0;

    // CHECK 1: Database Schema Integrity
    console.log('1️⃣  Checking Database Integrity...');
    // We try to access the view. If it fails, Schema is broken.
    const { error: viewError } = await supabase.from('powerup_state_view').select('powerup_id').limit(1);

    if (viewError) {
        console.error('   ❌ View powerup_state_view MISSING or inaccessible:', viewError.message);
        throw new Error('Database Integrity Failed');
    }
    console.log('   ✅ Schema Verification Passed (View accessible)');
    checksPassed++;

    // CHECK 2: User Creation
    console.log('\n2️⃣  Verifying User Onboarding...');
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
    });
    if (authError) throw authError;
    const userId = authData.user!.id;
    console.log(`   ✅ User Created: ${userId}`);

    // Login
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
    });
    if (loginError) throw loginError;
    const token = loginData.session!.access_token;
    checksPassed++;

    // Setup Profile & Quest (Simulate Backend Setup)
    // We create a profile with a 10-day streak to test multipliers properly
    await supabase.from('profiles').upsert({
        id: userId,
        username: 'LaunchTester',
        xp: 0,
        level: 1,
        streak: 10,
        last_quest_date: new Date(Date.now() - 86400000).toISOString() // Yesterday
    });

    // Fetch a valid quest ID
    const { data: questData, error: questFetchError } = await supabase.from('daily_quests').select('id').limit(1).single();
    if (questFetchError) {
        console.error('Failed to fetch a valid daily_quest:', questFetchError);
        // Fallback or throw? We need a quest.
        // If no quests exist, we can't test.
        // But seed_quests.ts exists so quests should be there.
        throw new Error('No Quests Found in DB');
    }
    const realQuestId = questData.id;

    const questLogId = crypto.randomUUID();
    const { error: questError } = await supabase.from('user_quest_log').insert({
        id: questLogId,
        user_id: userId,
        quest_id: realQuestId,
        status: 'active'
    });
    if (questError) {
        console.error('Quest Insert Error:', questError);
        throw new Error('Quest Setup Failed');
    }


    // CHECK 3: Power-Up Activation (The Core)
    console.log('\n3️⃣  Testing Canonical Power-Up Activation...');
    const applyRes = await fetch(`${SUPABASE_URL}/functions/v1/apply-powerup`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ powerup_id: 'blood_oath' })
    });
    const applyJson = await applyRes.json();
    if (!applyJson.success) {
        console.error('Apply Response:', JSON.stringify(applyJson, null, 2));
        throw new Error(`PowerUp Activation Failed: ${applyJson.error || 'Unknown Error'}`);
    }

    // Verify Idempotency immediately
    const startReplay = Date.now();
    const replayRes = await fetch(`${SUPABASE_URL}/functions/v1/apply-powerup`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ powerup_id: 'blood_oath' })
    });
    const replayJson = await replayRes.json();
    if (!replayJson.success || !replayJson.idempotent) throw new Error('Idempotency Check Failed');

    console.log(`   ✅ Activation & Idempotency Validated (${Date.now() - startReplay}ms replay)`);
    checksPassed++;

    // CHECK 4: Quest Completion with Multiplier
    console.log('\n4️⃣  Testing Quest Completion (Active Power-Up)...');
    const completeRes = await fetch(`${SUPABASE_URL}/functions/v1/complete-quest`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_id: questLogId, reflection_text: 'Launch ready system behaving optimally.' })
    });
    const completeJson = await completeRes.json();
    if (!completeJson.success) throw new Error(`Completion Failed: ${completeJson.error}`);

    // Validate Math: Base(250) + Streak(11*10=110) = 360.
    // Blood Oath = 3x. 360 * 3 = 1080.
    console.log(`   XP Awarded: ${completeJson.xp_awarded} (Expected ~1080)`);
    if (completeJson.xp_awarded < 1000) throw new Error('XP Multiplier NOT Applied correctly');

    console.log('   ✅ Quest Cycle & Multiplier Validated');
    checksPassed++;

    // CHECK 5: Timeline View Consistency
    console.log('\n5️⃣  Verifying Visual Timeline Source-of-Truth...');
    const { data: viewData, error: viewQueryError } = await supabase
        .from('powerup_state_view')
        .select('*')
        .eq('user_id', userId)
        .eq('powerup_id', 'blood_oath')
        .single();

    if (viewQueryError) throw viewQueryError;
    if (viewData.state !== 'active') throw new Error(`Timeline View mismatch. Expected 'active', got '${viewData.state}'`);

    console.log('   ✅ Timeline View Validated (State: active)');
    checksPassed++;

    console.log('\n---------------------------------------------------');
    console.log('🎉 CERTIFICATION COMPLETE. ALL SYSTEMS OPERATIONAL. 🎉');
    console.log('---------------------------------------------------');
}

certify().catch(e => {
    console.error('\n❌ CERTIFICATION FAILED:', e.message || e);
    process.exit(1);
});
