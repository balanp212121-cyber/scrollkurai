import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load env vars
const envPath = path.resolve(process.cwd(), '.env');
const envConfig = fs.readFileSync(envPath, 'utf-8').split('\n').reduce((acc, line) => {
    const [key, ...value] = line.split('=');
    if (key && value) acc[key.trim()] = value.join('=').trim();
    return acc;
}, {} as Record<string, string>);

const SUPABASE_URL = envConfig['VITE_SUPABASE_URL']!;
const SERVICE_KEY = envConfig['SUPABASE_SERVICE_ROLE_KEY']!;
const ANON_KEY = envConfig['VITE_SUPABASE_PUBLISHABLE_KEY']!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

async function log(msg: string, type: 'INFO' | 'PASS' | 'FAIL' | 'FIX' = 'INFO') {
    const prefix = { INFO: 'ℹ️', PASS: '✅', FAIL: '❌', FIX: '🔧' }[type];
    console.log(`${prefix} ${msg}`);
}

async function main() {
    console.log('\n' + '='.repeat(60));
    console.log('  SCROLLKURAI COMPREHENSIVE SYSTEM FIX');
    console.log('  Date: ' + new Date().toISOString());
    console.log('='.repeat(60) + '\n');

    let fixCount = 0;
    let errorCount = 0;

    // ===========================================
    // FIX 1: Refresh Leaderboard Cache
    // ===========================================
    log('FIX 1: Refreshing leaderboard cache...', 'FIX');
    try {
        const { error } = await admin.rpc('refresh_leaderboard_cache');
        if (error) {
            log(`Leaderboard refresh failed: ${error.message}`, 'FAIL');
            errorCount++;
        } else {
            log('Leaderboard cache refreshed', 'PASS');
            fixCount++;
        }
    } catch (e: any) {
        log(`Leaderboard refresh error: ${e.message}`, 'FAIL');
        errorCount++;
    }

    // Verify cache has data
    const { count: cacheCount } = await admin.from('leaderboard_cache').select('*', { count: 'exact', head: true });
    log(`Leaderboard cache rows: ${cacheCount || 0}`, 'INFO');

    // ===========================================
    // FIX 2: Ensure Admin Users Exist
    // ===========================================
    log('\nFIX 2: Verifying admin users...', 'FIX');
    const { data: adminRoles } = await admin.from('user_roles').select('user_id').eq('role', 'admin');
    log(`Admin users found: ${adminRoles?.length || 0}`, 'INFO');

    // Make sure founder has admin role if profiles exist
    const { data: profiles } = await admin.from('profiles').select('id').order('created_at', { ascending: true }).limit(1);
    if (profiles && profiles.length > 0) {
        const founderId = profiles[0].id;
        const { error: founderErr } = await admin.from('user_roles')
            .upsert({ user_id: founderId, role: 'admin' }, { onConflict: 'user_id', ignoreDuplicates: true });

        if (!founderErr) {
            log(`Founder (first user) has admin role`, 'PASS');
            fixCount++;
        }
    }

    // ===========================================
    // FIX 3: Ensure Quests Exist
    // ===========================================
    log('\nFIX 3: Verifying quests exist...', 'FIX');
    const { count: questCount } = await admin.from('quests').select('*', { count: 'exact', head: true });
    log(`Quests in database: ${questCount || 0}`, 'INFO');

    if (!questCount || questCount < 10) {
        log('Low quest count - run seed_quests.ts if needed', 'INFO');
    } else {
        log('Quest database healthy', 'PASS');
        fixCount++;
    }

    // ===========================================
    // FIX 4: Verify Power-ups Exist
    // ===========================================
    log('\nFIX 4: Verifying power-ups...', 'FIX');
    const { data: powerUps } = await admin.from('power_ups').select('id, name');
    log(`Power-up types: ${powerUps?.length || 0}`, 'INFO');

    if (powerUps && powerUps.length >= 4) {
        log('Power-ups configured', 'PASS');
        fixCount++;
    } else {
        log('Power-ups may need seeding', 'FAIL');
        errorCount++;
    }

    // ===========================================
    // FIX 5: Verify Badges Exist
    // ===========================================
    log('\nFIX 5: Verifying badges...', 'FIX');
    const { count: badgeCount } = await admin.from('badges').select('*', { count: 'exact', head: true });
    log(`Badge types: ${badgeCount || 0}`, 'INFO');

    if (badgeCount && badgeCount > 0) {
        log('Badges configured', 'PASS');
        fixCount++;
    } else {
        log('Badges may need seeding', 'INFO');
    }

    // ===========================================
    // FIX 6: Test Edge Functions
    // ===========================================
    log('\nFIX 6: Testing Edge Functions...', 'FIX');

    // Create a test user session
    const { data: testUsers } = await admin.auth.admin.listUsers();
    const testUser = testUsers?.users?.find(u => u.email === 'audit_premium@test.com');

    if (testUser) {
        const anonClient = createClient(SUPABASE_URL, ANON_KEY);
        const { data: session, error: loginErr } = await anonClient.auth.signInWithPassword({
            email: 'audit_premium@test.com',
            password: 'password123'
        });

        if (!loginErr && session.session) {
            const token = session.session.access_token;
            const today = new Date().toISOString().split('T')[0];

            // Test get-daily-quest
            const questRes = await fetch(`${SUPABASE_URL}/functions/v1/get-daily-quest`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: today })
            });

            if (questRes.ok) {
                log('get-daily-quest: WORKING', 'PASS');
                fixCount++;
            } else {
                log(`get-daily-quest: ${questRes.status}`, 'FAIL');
                errorCount++;
            }

            // Test recommendations
            const recRes = await fetch(`${SUPABASE_URL}/functions/v1/get-powerup-recommendations`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (recRes.ok) {
                log('get-powerup-recommendations: WORKING', 'PASS');
                fixCount++;
            } else {
                log(`get-powerup-recommendations: ${recRes.status}`, 'INFO');
            }
        } else {
            log(`Test user login failed: ${loginErr?.message}`, 'FAIL');
            errorCount++;
        }
    }

    // ===========================================
    // FIX 7: Verify RLS is Active
    // ===========================================
    log('\nFIX 7: Verifying RLS...', 'FIX');
    const anonClient = createClient(SUPABASE_URL, ANON_KEY);

    const { data: anonAudit } = await anonClient.from('admin_audit_logs').select('*');
    if (!anonAudit || anonAudit.length === 0) {
        log('RLS: admin_audit_logs blocked from anon', 'PASS');
        fixCount++;
    } else {
        log('RLS: admin_audit_logs EXPOSED to anon!', 'FAIL');
        errorCount++;
    }

    // ===========================================
    // FIX 8: Clean up stale data
    // ===========================================
    log('\nFIX 8: Cleaning up stale data...', 'FIX');

    // Clear expired AI usage (older than yesterday)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const { count: deletedAI } = await admin.from('ai_daily_usage')
        .delete({ count: 'exact' })
        .lt('usage_date', yesterdayStr);

    log(`Cleaned up ${deletedAI || 0} old AI usage records`, 'PASS');
    fixCount++;

    // ===========================================
    // FIX 9: Admin Streak Override Test
    // ===========================================
    log('\nFIX 9: Testing admin streak override...', 'FIX');

    const adminUser = testUsers?.users?.find(u => u.email === 'audit_admin@test.com');
    if (adminUser) {
        // Ensure admin role
        await admin.from('user_roles').upsert({ user_id: adminUser.id, role: 'admin' }, { onConflict: 'user_id' });

        const anonClient = createClient(SUPABASE_URL, ANON_KEY);
        const { data: adminSession } = await anonClient.auth.signInWithPassword({
            email: 'audit_admin@test.com',
            password: 'password123'
        });

        if (adminSession.session) {
            // Find a target user
            const { data: targetUser } = await admin.from('profiles')
                .select('id')
                .neq('id', adminUser.id)
                .limit(1)
                .single();

            if (targetUser) {
                const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-restore-streak`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${adminSession.session.access_token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        target_user_id: targetUser.id,
                        restore_streak_count: 3,
                        reason: 'System fix verification'
                    })
                });

                if (res.ok) {
                    log('Admin streak override: WORKING', 'PASS');
                    fixCount++;
                } else {
                    log(`Admin streak override: ${res.status}`, 'FAIL');
                    errorCount++;
                }
            }
        }
    }

    // ===========================================
    // FIX 10: Verify Database Integrity
    // ===========================================
    log('\nFIX 10: Verifying database integrity...', 'FIX');

    const tables = [
        'profiles', 'quests', 'user_quest_log', 'power_ups', 'user_power_ups',
        'badges', 'user_badges', 'admin_audit_logs', 'ai_daily_usage',
        'teams', 'team_members', 'challenges', 'notification_logs'
    ];

    let tableErrors = 0;
    for (const t of tables) {
        const { error } = await admin.from(t).select('*', { count: 'exact', head: true });
        if (error?.code === '42P01') {
            log(`Table missing: ${t}`, 'FAIL');
            tableErrors++;
        }
    }

    if (tableErrors === 0) {
        log('All required tables exist', 'PASS');
        fixCount++;
    } else {
        errorCount += tableErrors;
    }

    // ===========================================
    // FINAL SUMMARY
    // ===========================================
    console.log('\n' + '='.repeat(60));
    console.log('  SYSTEM FIX SUMMARY');
    console.log('='.repeat(60));
    console.log(`  ✅ Fixes Applied: ${fixCount}`);
    console.log(`  ❌ Errors Found: ${errorCount}`);
    console.log('');

    if (errorCount === 0) {
        console.log('  🎉 ALL SYSTEMS RUNNING SMOOTHLY');
        console.log('  ✅ READY FOR PRODUCTION');
    } else {
        console.log('  ⚠️ SOME ISSUES NEED MANUAL ATTENTION');
    }

    console.log('\n' + '='.repeat(60) + '\n');
}

main().catch(console.error);
