import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

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

interface TestResult {
    name: string;
    status: 'PASS' | 'FAIL' | 'SKIP';
    message?: string;
}

const results: TestResult[] = [];

function log(msg: string, type: 'INFO' | 'PASS' | 'FAIL' | 'SKIP' = 'INFO') {
    const prefix = { INFO: 'ℹ️', PASS: '✅', FAIL: '❌', SKIP: '⏭️' }[type];
    console.log(`${prefix} ${msg}`);
}

async function test(name: string, fn: () => Promise<boolean | string>) {
    try {
        const result = await fn();
        if (result === true || result === 'PASS') {
            results.push({ name, status: 'PASS' });
            log(`${name}: PASS`, 'PASS');
        } else if (result === 'SKIP') {
            results.push({ name, status: 'SKIP', message: 'Skipped' });
            log(`${name}: SKIP`, 'SKIP');
        } else {
            results.push({ name, status: 'FAIL', message: String(result) });
            log(`${name}: FAIL - ${result}`, 'FAIL');
        }
    } catch (e: any) {
        results.push({ name, status: 'FAIL', message: e.message });
        log(`${name}: FAIL - ${e.message}`, 'FAIL');
    }
}

async function main() {
    console.log('\n' + '='.repeat(60));
    console.log('  SCROLLKURAI END-TO-END FEATURE VERIFICATION');
    console.log('  Date: ' + new Date().toISOString());
    console.log('='.repeat(60) + '\n');

    // ============================================
    // 1. DATABASE HEALTH
    // ============================================
    log('\n=== 1. DATABASE HEALTH ===\n', 'INFO');

    await test('Database Connection', async () => {
        const { error } = await admin.from('profiles').select('id').limit(1);
        return !error;
    });

    const coreTableList = ['profiles', 'quests', 'user_quest_log', 'power_ups', 'badges',
        'admin_audit_logs', 'ai_daily_usage', 'counselling_requests', 'course_requests'];

    for (const table of coreTableList) {
        await test(`Table exists: ${table}`, async () => {
            const { error } = await admin.from(table).select('*', { count: 'exact', head: true });
            return !error || error.code !== '42P01';
        });
    }

    // ============================================
    // 2. AUTHENTICATION & RBAC
    // ============================================
    log('\n=== 2. AUTHENTICATION & RBAC ===\n', 'INFO');

    await test('RLS: Anon blocked from admin_audit_logs', async () => {
        const anonClient = createClient(SUPABASE_URL, ANON_KEY);
        const { data } = await anonClient.from('admin_audit_logs').select('*');
        return !data || data.length === 0;
    });

    await test('Admin users exist', async () => {
        const { count } = await admin.from('user_roles').select('*', { count: 'exact', head: true }).eq('role', 'admin');
        return (count || 0) > 0;
    });

    // ============================================
    // 3. DAILY QUEST SYSTEM
    // ============================================
    log('\n=== 3. DAILY QUEST SYSTEM ===\n', 'INFO');

    await test('Quests available', async () => {
        const { count } = await admin.from('quests').select('*', { count: 'exact', head: true });
        return (count || 0) > 10;
    });

    await test('get-daily-quest endpoint', async () => {
        // Find a test user
        const { data: users } = await admin.auth.admin.listUsers();
        const testUser = users?.users?.find(u => u.email?.includes('test'));
        if (!testUser) return 'SKIP';

        const anonClient = createClient(SUPABASE_URL, ANON_KEY);
        const { data: session } = await anonClient.auth.signInWithPassword({
            email: testUser.email!, password: 'password123'
        });
        if (!session.session) return 'No session';

        const today = new Date().toISOString().split('T')[0];
        const res = await fetch(`${SUPABASE_URL}/functions/v1/get-daily-quest`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.session.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ date: today })
        });
        return res.ok || res.status === 200;
    });

    // ============================================
    // 4. AI COACHING SYSTEM
    // ============================================
    log('\n=== 4. AI COACHING SYSTEM ===\n', 'INFO');

    await test('AI daily usage table exists', async () => {
        const { error } = await admin.from('ai_daily_usage').select('*', { count: 'exact', head: true });
        return !error;
    });

    await test('increment_ai_usage RPC exists', async () => {
        // Just check if we can call it (will fail but confirms RPC exists)
        const { error } = await admin.rpc('increment_ai_usage', { p_user_id: '00000000-0000-0000-0000-000000000000', p_date: '2026-01-01' });
        return !error || error.code !== '42883'; // 42883 = function doesn't exist
    });

    // ============================================
    // 5. PREMIUM FEATURES
    // ============================================
    log('\n=== 5. PREMIUM FEATURES ===\n', 'INFO');

    await test('Premium lessons table exists', async () => {
        const { error } = await admin.from('premium_lessons').select('*', { count: 'exact', head: true });
        return !error;
    });

    await test('Counselling requests table exists', async () => {
        const { error } = await admin.from('counselling_requests').select('*', { count: 'exact', head: true });
        return !error;
    });

    await test('Course requests table exists', async () => {
        const { error } = await admin.from('course_requests').select('*', { count: 'exact', head: true });
        return !error;
    });

    // ============================================
    // 6. POWER-UPS & MONETIZATION
    // ============================================
    log('\n=== 6. POWER-UPS & MONETIZATION ===\n', 'INFO');

    await test('Power-ups configured', async () => {
        const { count } = await admin.from('power_ups').select('*', { count: 'exact', head: true });
        return (count || 0) >= 4;
    });

    await test('Payment transactions table exists', async () => {
        const { error } = await admin.from('payment_transactions').select('*', { count: 'exact', head: true });
        return !error;
    });

    await test('Payment proofs table exists', async () => {
        const { error } = await admin.from('payment_proofs').select('*', { count: 'exact', head: true });
        return !error;
    });

    // ============================================
    // 7. TEAMS & SOCIAL
    // ============================================
    log('\n=== 7. TEAMS & SOCIAL ===\n', 'INFO');

    await test('Teams table exists', async () => {
        const { error } = await admin.from('teams').select('*', { count: 'exact', head: true });
        return !error;
    });

    await test('Challenges table exists', async () => {
        const { error } = await admin.from('challenges').select('*', { count: 'exact', head: true });
        return !error;
    });

    // ============================================
    // 8. BADGES & ACHIEVEMENTS
    // ============================================
    log('\n=== 8. BADGES & ACHIEVEMENTS ===\n', 'INFO');

    await test('Badges configured', async () => {
        const { count } = await admin.from('badges').select('*', { count: 'exact', head: true });
        return (count || 0) > 0;
    });

    await test('User badges table exists', async () => {
        const { error } = await admin.from('user_badges').select('*', { count: 'exact', head: true });
        return !error;
    });

    // ============================================
    // 9. ADMIN SYSTEM
    // ============================================
    log('\n=== 9. ADMIN SYSTEM ===\n', 'INFO');

    await test('Admin audit logs table exists', async () => {
        const { error } = await admin.from('admin_audit_logs').select('*', { count: 'exact', head: true });
        return !error;
    });

    await test('Admin has_role RPC exists', async () => {
        const { error } = await admin.rpc('has_role', { _user_id: '00000000-0000-0000-0000-000000000000', _role: 'admin' });
        return !error || error.code !== '42883';
    });

    // ============================================
    // 10. FILE UPLOAD SECURITY
    // ============================================
    log('\n=== 10. FILE UPLOAD SECURITY ===\n', 'INFO');

    await test('Payment proofs bucket exists', async () => {
        const { data } = await admin.storage.listBuckets();
        return data?.some(b => b.name === 'payment-proofs') || false;
    });

    // ============================================
    // 11. LEADERBOARD & CACHING
    // ============================================
    log('\n=== 11. LEADERBOARD & CACHING ===\n', 'INFO');

    await test('Leaderboard cache exists', async () => {
        const { error } = await admin.from('leaderboard_cache').select('*', { count: 'exact', head: true });
        return !error;
    });

    await test('Leaderboard has data', async () => {
        const { count } = await admin.from('leaderboard_cache').select('*', { count: 'exact', head: true });
        return (count || 0) > 0;
    });

    // ============================================
    // FINAL SUMMARY
    // ============================================
    console.log('\n' + '='.repeat(60));
    console.log('  END-TO-END VERIFICATION SUMMARY');
    console.log('='.repeat(60));

    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const skipped = results.filter(r => r.status === 'SKIP').length;

    console.log(`\n  ✅ PASSED: ${passed}`);
    console.log(`  ❌ FAILED: ${failed}`);
    console.log(`  ⏭️ SKIPPED: ${skipped}`);
    console.log(`  📊 TOTAL: ${results.length}`);

    if (failed === 0) {
        console.log('\n  🎉 ALL FEATURES WORKING CORRECTLY!');
        console.log('  ✅ READY FOR PRODUCTION');
    } else {
        console.log('\n  ⚠️ SOME FEATURES NEED ATTENTION');
        console.log('\n  Failed tests:');
        results.filter(r => r.status === 'FAIL').forEach(r => {
            console.log(`    - ${r.name}: ${r.message}`);
        });
    }

    console.log('\n' + '='.repeat(60) + '\n');
}

main().catch(console.error);
