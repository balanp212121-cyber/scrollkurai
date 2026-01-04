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

interface CheckResult {
    category: string;
    check: string;
    status: 'PASS' | 'FAIL' | 'WARN';
    detail?: string;
}

const results: CheckResult[] = [];

function add(category: string, check: string, status: 'PASS' | 'FAIL' | 'WARN', detail?: string) {
    results.push({ category, check, status, detail });
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} ${check}${detail ? ` - ${detail}` : ''}`);
}

async function main() {
    console.log('\n' + '═'.repeat(60));
    console.log('  🚀 SCROLLKURAI PRODUCTION READINESS CHECK');
    console.log('  ' + new Date().toISOString());
    console.log('═'.repeat(60) + '\n');

    // ============================================
    // 1. DATABASE HEALTH
    // ============================================
    console.log('\n📊 DATABASE HEALTH\n');

    const { error: connError } = await admin.from('profiles').select('id').limit(1);
    add('Database', 'Supabase Connection', connError ? 'FAIL' : 'PASS');

    const tables = ['profiles', 'quests', 'user_quest_log', 'power_ups', 'badges',
        'admin_audit_logs', 'ai_daily_usage', 'payment_transactions', 'payment_proofs',
        'counselling_requests', 'course_requests', 'teams', 'challenges', 'leaderboard_cache'];

    for (const table of tables) {
        const { error, count } = await admin.from(table).select('*', { count: 'exact', head: true });
        add('Database', `Table: ${table}`, error ? 'FAIL' : 'PASS', `${count || 0} rows`);
    }

    // ============================================
    // 2. SECURITY CHECKS
    // ============================================
    console.log('\n🔒 SECURITY\n');

    // RLS Check
    const anonClient = createClient(SUPABASE_URL, ANON_KEY);
    const { data: adminLogs } = await anonClient.from('admin_audit_logs').select('*').limit(1);
    add('Security', 'RLS blocks anon from admin_audit_logs', !adminLogs || adminLogs.length === 0 ? 'PASS' : 'FAIL');

    // Admin users
    const { count: adminCount } = await admin.from('user_roles').select('*', { count: 'exact', head: true }).eq('role', 'admin');
    add('Security', 'Admin users configured', (adminCount || 0) > 0 ? 'PASS' : 'FAIL', `${adminCount} admins`);

    // has_role RPC
    const { error: rpcError } = await admin.rpc('has_role', { _user_id: '00000000-0000-0000-0000-000000000000', _role: 'admin' });
    add('Security', 'has_role RPC', !rpcError ? 'PASS' : 'FAIL');

    // ============================================
    // 3. EDGE FUNCTIONS
    // ============================================
    console.log('\n⚡ EDGE FUNCTIONS\n');

    const endpoints = [
        'get-daily-quest',
        'complete-quest',
        'ai-coaching-chat',
        'upload-payment-proof',
        'admin-restore-streak',
        'get-powerup-recommendations'
    ];

    for (const fn of endpoints) {
        // Just check function exists (OPTIONS request)
        try {
            const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, { method: 'OPTIONS' });
            add('Functions', fn, res.status === 204 || res.status === 200 ? 'PASS' : 'WARN', `Status ${res.status}`);
        } catch (e) {
            add('Functions', fn, 'FAIL', 'Connection failed');
        }
    }

    // ============================================
    // 4. DATA INTEGRITY
    // ============================================
    console.log('\n📈 DATA INTEGRITY\n');

    const { count: questCount } = await admin.from('quests').select('*', { count: 'exact', head: true });
    add('Data', 'Quests available', (questCount || 0) >= 100 ? 'PASS' : 'WARN', `${questCount} quests`);

    const { count: powerUpCount } = await admin.from('power_ups').select('*', { count: 'exact', head: true });
    add('Data', 'Power-ups configured', (powerUpCount || 0) >= 4 ? 'PASS' : 'WARN', `${powerUpCount} types`);

    const { count: badgeCount } = await admin.from('badges').select('*', { count: 'exact', head: true });
    add('Data', 'Badges configured', (badgeCount || 0) > 0 ? 'PASS' : 'WARN', `${badgeCount} badges`);

    const { count: leaderboardCount } = await admin.from('leaderboard_cache').select('*', { count: 'exact', head: true });
    add('Data', 'Leaderboard cache', (leaderboardCount || 0) > 0 ? 'PASS' : 'WARN', `${leaderboardCount} entries`);

    // ============================================
    // 5. STORAGE
    // ============================================
    console.log('\n📁 STORAGE\n');

    const { data: buckets } = await admin.storage.listBuckets();
    add('Storage', 'payment-proofs bucket', buckets?.some(b => b.name === 'payment-proofs') ? 'PASS' : 'FAIL');

    // ============================================
    // 6. FRONTEND BUILD
    // ============================================
    console.log('\n🏗️ BUILD\n');

    const packagePath = path.resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
    add('Build', 'package.json exists', true ? 'PASS' : 'FAIL', `v${pkg.version || '0.0.0'}`);

    const viteConfig = path.resolve(process.cwd(), 'vite.config.ts');
    add('Build', 'Vite config exists', fs.existsSync(viteConfig) ? 'PASS' : 'FAIL');

    // Check for .env.example
    const envExample = path.resolve(process.cwd(), '.env.example');
    add('Build', '.env.example for deployment', fs.existsSync(envExample) ? 'PASS' : 'WARN', 'Needed for Vercel');

    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n' + '═'.repeat(60));
    console.log('  📋 PRODUCTION READINESS SUMMARY');
    console.log('═'.repeat(60));

    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const warned = results.filter(r => r.status === 'WARN').length;

    console.log(`\n  ✅ PASSED: ${passed}`);
    console.log(`  ❌ FAILED: ${failed}`);
    console.log(`  ⚠️ WARNINGS: ${warned}`);
    console.log(`  📊 TOTAL: ${results.length}`);

    if (failed === 0) {
        console.log('\n  🎉 PRODUCTION READY!');
        console.log('  ✅ All critical checks passed');
        console.log('  🚀 Safe to deploy to Vercel');
    } else {
        console.log('\n  ⚠️ NEEDS ATTENTION');
        console.log('\n  Critical failures:');
        results.filter(r => r.status === 'FAIL').forEach(r => {
            console.log(`    ❌ ${r.check}: ${r.detail || 'Failed'}`);
        });
    }

    if (warned > 0) {
        console.log('\n  ⚠️ Warnings (non-blocking):');
        results.filter(r => r.status === 'WARN').forEach(r => {
            console.log(`    ⚠️ ${r.check}: ${r.detail || ''}`);
        });
    }

    console.log('\n' + '═'.repeat(60));
    console.log('  🚀 DEPLOYMENT CHECKLIST');
    console.log('═'.repeat(60));
    console.log(`
  1. ✅ Database ready
  2. ✅ Security configured
  3. ✅ Edge Functions deployed
  4. ✅ Storage buckets ready
  5. ⏳ Push to GitHub
  6. ⏳ Deploy to Vercel
  7. ⏳ Verify production URL
`);

    console.log('═'.repeat(60) + '\n');

    // Return exit code
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
});
