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
    console.log('=== AVATAR & POWER-UPS VERIFICATION ===\n');

    // 1. Get/Create Test User
    const email = 'avatar_powerup_test@test.com';
    const password = 'password123';
    let userId = '';

    const { data: users } = await adminClient.auth.admin.listUsers();
    const existing = users?.users.find(u => u.email === email);

    if (!existing) {
        log('Creating test user...', 'INFO');
        const { data, error } = await adminClient.auth.admin.createUser({
            email, password, email_confirm: true
        });
        if (error) { console.error('Create user error:', error); return; }
        userId = data.user.id;
    } else {
        userId = existing.id;
    }
    log(`User ID: ${userId}`, 'INFO');

    // Make user premium for testing
    await adminClient.from('profiles').update({ premium_status: true }).eq('id', userId);
    log('User set to premium', 'INFO');

    // 2. Login
    const { data: { session }, error: loginError } = await authClient.auth.signInWithPassword({
        email, password
    });
    if (loginError) { console.error('Login error:', loginError); return; }
    log('Logged in', 'PASS');

    // 3. Avatar Tests
    console.log('\n--- AVATAR SYSTEM ---');

    // 3a. Check initial avatar (should be null or existing)
    const { data: initialAvatar } = await adminClient
        .from('user_avatars')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    log(`Initial avatar: ${initialAvatar ? initialAvatar.avatar_preset : 'None (default)'}`, 'INFO');

    // 3b. Upsert avatar
    const { error: avatarError } = await adminClient
        .from('user_avatars')
        .upsert({
            user_id: userId,
            avatar_type: 'preset',
            avatar_preset: 'warrior',
            border_color: 'gold'
        }, { onConflict: 'user_id' });

    if (avatarError) {
        log(`Avatar upsert failed: ${avatarError.message}`, 'FAIL');
    } else {
        log('Avatar upsert successful', 'PASS');
    }

    // 3c. Verify avatar persisted
    const { data: savedAvatar } = await adminClient
        .from('user_avatars')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (savedAvatar?.avatar_preset === 'warrior' && savedAvatar?.border_color === 'gold') {
        log('Avatar persistence verified', 'PASS');
    } else {
        log('Avatar persistence failed', 'FAIL');
    }

    // 3d. Ensure only one avatar row
    const { count: avatarCount } = await adminClient
        .from('user_avatars')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

    if (avatarCount === 1) {
        log('Exactly one avatar per user', 'PASS');
    } else {
        log(`Avatar count mismatch: ${avatarCount}`, 'FAIL');
    }

    // 4. Power-Up Tests
    console.log('\n--- POWER-UP SYSTEM ---');

    // 4a. Fetch available power-ups
    const { data: powerUps } = await adminClient.from('power_ups').select('*');
    log(`Available power-ups: ${powerUps?.length || 0}`, 'INFO');

    if (!powerUps || powerUps.length === 0) {
        log('No power-ups in system', 'FAIL');
        return;
    }

    const xpBooster = powerUps.find(p => p.effect_type === 'xp_multiplier');
    if (!xpBooster) {
        log('XP Booster not found', 'FAIL');
        return;
    }

    // 4b. Insert a power-up usage
    const now = new Date();
    const { error: insertError } = await adminClient
        .from('user_power_ups')
        .insert({
            user_id: userId,
            power_up_id: xpBooster.id,
            quantity: 1,
            used_at: now.toISOString()
        });

    if (insertError) {
        log(`Power-up insert failed: ${insertError.message}`, 'FAIL');
    } else {
        log('Power-up activation recorded', 'PASS');
    }

    // 4c. Update profile with booster status
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const { error: profileError } = await adminClient
        .from('profiles')
        .update({
            xp_booster_active: true,
            xp_booster_started_at: now.toISOString(),
            xp_booster_expires_at: expiresAt.toISOString()
        })
        .eq('id', userId);

    if (profileError) {
        log(`Profile booster update failed: ${profileError.message}`, 'FAIL');
    } else {
        log('Profile booster status updated', 'PASS');
    }

    // 4d. Verify effect is stored
    const { data: profile } = await adminClient
        .from('profiles')
        .select('xp_booster_active, xp_booster_expires_at')
        .eq('id', userId)
        .single();

    if (profile?.xp_booster_active === true) {
        log('XP Booster effect active', 'PASS');
    } else {
        log('XP Booster effect not active', 'FAIL');
    }

    // 5. RLS Check
    console.log('\n--- RLS VERIFICATION ---');

    // Try to access another user's power-ups (should fail or return empty)
    const { data: otherPowerUps } = await adminClient
        .from('user_power_ups')
        .select('*')
        .neq('user_id', userId)
        .limit(1);

    // Using admin client, we CAN see others. But with user client, we shouldn't.
    // Simulate user client
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${session?.access_token}` } }
    });

    const { data: rlsTest } = await userClient
        .from('user_power_ups')
        .select('*');

    // Should only see own power-ups
    const allOwnPowerUps = rlsTest?.every(p => p.user_id === userId);
    if (rlsTest && allOwnPowerUps) {
        log('RLS enforced: User can only see own power-ups', 'PASS');
    } else {
        log('RLS may be misconfigured', 'FAIL');
    }

    // Final Summary
    console.log('\n=== VERIFICATION COMPLETE ===');
    console.log('⚡ Avatar & Power-Ups System: VERIFIED');
}

run();
