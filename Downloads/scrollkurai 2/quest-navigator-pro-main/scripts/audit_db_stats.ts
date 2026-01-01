import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

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
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || envConfig['SUPABASE_SERVICE_ROLE_KEY'];

const admin = createClient(SUPABASE_URL!, SERVICE_KEY!);

async function main() {
    console.log('=== DATABASE STATISTICS ===');

    // 1. Count all tables
    const tables = [
        'profiles', 'user_quest_log', 'user_streaks', 'user_league_xp',
        'teams', 'team_members', 'challenges', 'challenge_participants',
        'power_ups', 'user_power_ups', 'streak_shields', 'badges', 'user_badges',
        'counselling_requests', 'payment_transactions', 'admin_audit_logs',
        'ai_daily_usage', 'notification_logs', 'reward_grants', 'discount_coupons',
        'leaderboard_cache'
    ];

    const tableCounts: Record<string, number | string> = {};
    for (const t of tables) {
        const { count, error } = await admin.from(t).select('*', { count: 'exact', head: true });
        tableCounts[t] = error ? `MISSING (${error.code})` : (count || 0);
    }

    console.log('\nTable Row Counts:');
    for (const [table, count] of Object.entries(tableCounts)) {
        console.log(`  ${table}: ${count}`);
    }

    // 2. User statistics
    const { count: totalUsers } = await admin.from('profiles').select('*', { count: 'exact', head: true });
    const { data: activeStreakUsers } = await admin.from('profiles').select('id, streak').gt('streak', 0);
    const { data: premiumUsers } = await admin.from('profiles').select('id').eq('premium_status', true);

    console.log('\n=== USER SUMMARY ===');
    console.log(`Total Users: ${totalUsers || 0}`);
    console.log(`Users with Active Streak: ${activeStreakUsers?.length || 0}`);
    console.log(`Premium Users: ${premiumUsers?.length || 0}`);

    // 3. Quest statistics
    const today = new Date().toISOString().split('T')[0];
    const { count: todayQuests } = await admin.from('user_quest_log')
        .select('*', { count: 'exact', head: true })
        .eq('assignment_date', today);
    const { count: completedToday } = await admin.from('user_quest_log')
        .select('*', { count: 'exact', head: true })
        .eq('assignment_date', today)
        .not('completed_at', 'is', null);
    const { count: totalCompleted } = await admin.from('user_quest_log')
        .select('*', { count: 'exact', head: true })
        .not('completed_at', 'is', null);

    console.log('\n=== QUEST SUMMARY ===');
    console.log(`Total Quests Assigned Today (${today}): ${todayQuests || 0}`);
    console.log(`Quests Completed Today: ${completedToday || 0}`);
    console.log(`Total Quests Completed (All Time): ${totalCompleted || 0}`);

    // 4. Admin users
    const { data: adminRoles } = await admin.from('user_roles').select('user_id, role').eq('role', 'admin');
    console.log('\n=== ADMIN ROLES ===');
    console.log(`Admin Users: ${adminRoles?.length || 0}`);

    // 5. Fix admin role for audit_admin@test.com
    console.log('\n=== FIXING ADMIN TEST USER ===');
    const { data: testUsers } = await admin.auth.admin.listUsers();
    const testAdmin = testUsers?.users?.find(u => u.email === 'audit_admin@test.com');

    if (testAdmin) {
        const { error: roleError } = await admin
            .from('user_roles')
            .upsert({ user_id: testAdmin.id, role: 'admin' }, { onConflict: 'user_id' });

        if (roleError) {
            console.log(`❌ Failed to fix admin role: ${roleError.message}`);
        } else {
            console.log(`✅ Admin role fixed for audit_admin@test.com (${testAdmin.id})`);
        }
    } else {
        console.log('⚠️ Test admin user not found');
    }

    // 6. Re-verify admin count
    const { data: verifiedAdmins } = await admin.from('user_roles').select('user_id').eq('role', 'admin');
    console.log(`Total Admin Users After Fix: ${verifiedAdmins?.length || 0}`);

    // 7. Test admin streak override endpoint
    console.log('\n=== TESTING ADMIN STREAK OVERRIDE ===');
    if (testAdmin) {
        // Login as admin
        const anonClient = createClient(SUPABASE_URL!, envConfig['VITE_SUPABASE_PUBLISHABLE_KEY']!);
        const { data: session, error: loginErr } = await anonClient.auth.signInWithPassword({
            email: 'audit_admin@test.com',
            password: 'password123'
        });

        if (loginErr) {
            console.log(`❌ Admin login failed: ${loginErr.message}`);
        } else {
            // Call admin-restore-streak
            const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-restore-streak`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.session?.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    target_user_id: testAdmin.id,
                    restore_streak_count: 7,
                    reason: 'Audit test'
                })
            });

            const result = await res.json();
            console.log(`Admin Streak Override Test: ${res.status} - ${JSON.stringify(result)}`);

            if (res.ok) {
                console.log('✅ Admin streak override WORKING');
            } else {
                console.log(`❌ Admin streak override FAILED: ${res.status}`);
            }
        }
    }

    // 8. Power-up inventory
    const { data: powerUps } = await admin.from('power_ups').select('id, name');
    const { count: userPowerUps } = await admin.from('user_power_ups').select('*', { count: 'exact', head: true });

    console.log('\n=== POWER-UPS ===');
    console.log(`Power-Up Types: ${powerUps?.length || 0}`);
    powerUps?.forEach(p => console.log(`  - ${p.name}`));
    console.log(`User Power-Up Inventory Items: ${userPowerUps || 0}`);

    // 9. Badges
    const { data: badges } = await admin.from('badges').select('id, name, rarity');
    const { count: userBadges } = await admin.from('user_badges').select('*', { count: 'exact', head: true });

    console.log('\n=== BADGES ===');
    console.log(`Badge Types: ${badges?.length || 0}`);
    badges?.slice(0, 5).forEach(b => console.log(`  - ${b.name} (${b.rarity})`));
    if (badges && badges.length > 5) console.log(`  ... and ${badges.length - 5} more`);
    console.log(`Badges Earned by Users: ${userBadges || 0}`);

    // 10. AI Usage
    const { count: aiUsageToday } = await admin.from('ai_daily_usage')
        .select('*', { count: 'exact', head: true })
        .eq('usage_date', today);

    console.log('\n=== AI USAGE ===');
    console.log(`AI Usage Records Today: ${aiUsageToday || 0}`);

    console.log('\n=== AUDIT DATA COMPLETE ===');
}

main().catch(console.error);
