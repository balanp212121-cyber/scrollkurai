import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TEAM CREATION & ADMIN STREAK OVERRIDE AUDIT
// ============================================================================

const LOG_FILE = 'team_streak_audit_log.txt';
fs.writeFileSync(LOG_FILE, '');

function log(msg: string, type: 'INFO' | 'PASS' | 'FAIL' | 'SECTION' = 'INFO') {
    const ts = new Date().toISOString();
    const prefix = type === 'SECTION' ? '\n=== ' : `[${ts}] [${type}] `;
    const suffix = type === 'SECTION' ? ' ===' : '';
    const line = `${prefix}${msg}${suffix}`;
    console.log(line);
    fs.appendFileSync(LOG_FILE, line + '\n');
}

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
const anonClient = createClient(SUPABASE_URL, ANON_KEY);

// Test results
const results = {
    teamCreation: 'UNKNOWN',
    streakOverride: 'UNKNOWN',
    issues: [] as string[],
    fixes: [] as string[]
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function createTestUser(email: string, role: 'user' | 'admin' = 'user', premium = false) {
    const { data: users } = await adminClient.auth.admin.listUsers();
    let user = users?.users.find(u => u.email === email);

    if (!user) {
        const { data, error } = await adminClient.auth.admin.createUser({
            email, password: 'password123', email_confirm: true
        });
        if (error) throw new Error(`Failed to create ${email}: ${error.message}`);
        user = data.user;
    }

    if (role === 'admin') {
        await adminClient.from('user_roles').upsert({ user_id: user.id, role: 'admin' }, { onConflict: 'user_id' });
    }
    if (premium) {
        await adminClient.from('profiles').update({ premium_status: true }).eq('id', user.id);
    }
    return user;
}

async function loginUser(email: string) {
    const client = createClient(SUPABASE_URL!, ANON_KEY!);
    const { data, error } = await client.auth.signInWithPassword({ email, password: 'password123' });
    if (error) throw new Error(`Login failed: ${error.message}`);
    return { client, session: data.session!, user: data.user! };
}

// ============================================================================
// PART 1: TEAM CREATION VERIFICATION
// ============================================================================

async function verifyTeamCreation() {
    log('PART 1: TEAM CREATION VERIFICATION', 'SECTION');

    try {
        // 1A: Verify tables exist
        log('1A: Table verification', 'INFO');
        const { error: teamsErr } = await adminClient.from('teams').select('*', { count: 'exact', head: true });
        const { error: membersErr } = await adminClient.from('team_members').select('*', { count: 'exact', head: true });

        if (teamsErr) {
            log(`teams table missing: ${teamsErr.message}`, 'FAIL');
            results.issues.push('teams table missing');
            return false;
        }
        if (membersErr) {
            log(`team_members table missing: ${membersErr.message}`, 'FAIL');
            results.issues.push('team_members table missing');
            return false;
        }
        log('teams and team_members tables exist', 'PASS');

        // 1B: Test team creation
        log('1B: Team creation flow', 'INFO');
        const creator = await createTestUser('team_creator@test.com');
        const { session: creatorSession } = await loginUser('team_creator@test.com');

        const creatorClient = createClient(SUPABASE_URL!, ANON_KEY!, {
            global: { headers: { Authorization: `Bearer ${creatorSession.access_token}` } }
        });

        const teamName = `Test Team ${Date.now()}`;
        const { data: team, error: createErr } = await creatorClient
            .from('teams')
            .insert({ name: teamName, creator_id: creator.id })
            .select()
            .single();

        if (createErr) {
            log(`Team creation failed: ${createErr.message}`, 'FAIL');
            results.issues.push('Team creation failed');
            return false;
        }
        log(`Team created: ${team.id.substring(0, 8)}...`, 'PASS');

        // Check creator is added as member with admin role
        const { data: membership } = await adminClient
            .from('team_members')
            .select('*')
            .eq('team_id', team.id)
            .eq('user_id', creator.id)
            .single();

        if (!membership) {
            log('Creator not added as team admin automatically', 'FAIL');
            results.issues.push('Creator not auto-added as team member');
            // This may be expected if there's a trigger or frontend handles it
        } else if (membership.role === 'admin' || membership.role === 'creator') {
            log(`Creator has ${membership.role} role`, 'PASS');
        } else {
            log('Creator role is member, expected admin', 'FAIL');
        }

        // 1C: Test duplicate join prevention
        log('1C: Duplicate join prevention', 'INFO');
        const member = await createTestUser('team_member@test.com');

        // Add member
        await adminClient.from('team_members').insert({
            team_id: team.id,
            user_id: member.id,
            role: 'member'
        });

        // Try duplicate join
        const { error: dupErr } = await adminClient.from('team_members').insert({
            team_id: team.id,
            user_id: member.id,
            role: 'member'
        });

        if (dupErr && dupErr.code === '23505') {
            log('Duplicate join correctly blocked (unique constraint)', 'PASS');
        } else if (!dupErr) {
            log('Duplicate join NOT blocked - missing unique constraint', 'FAIL');
            results.issues.push('Duplicate team membership possible');
        } else {
            // Check for RLS or other prevention
            log(`Duplicate join blocked: ${dupErr.message}`, 'PASS');
        }

        // 1D: RLS Check - non-member cannot see team
        log('1D: RLS verification', 'INFO');
        const outsider = await createTestUser('team_outsider@test.com');
        const { session: outsiderSession } = await loginUser('team_outsider@test.com');

        const outsiderClient = createClient(SUPABASE_URL!, ANON_KEY!, {
            global: { headers: { Authorization: `Bearer ${outsiderSession.access_token}` } }
        });

        const { data: visibleTeams } = await outsiderClient
            .from('teams')
            .select('*')
            .eq('id', team.id);

        if (visibleTeams && visibleTeams.length > 0) {
            log('RLS FAIL: Outsider can see team data', 'FAIL');
            results.issues.push('RLS allows non-member team access');
        } else {
            log('RLS blocks outsider from team data', 'PASS');
        }

        // Cleanup
        await adminClient.from('teams').delete().eq('id', team.id);

        results.teamCreation = results.issues.filter(i => i.includes('team')).length === 0 ? 'PASS' : 'FAIL';
        return results.teamCreation === 'PASS';

    } catch (error: any) {
        log(`Team verification error: ${error.message}`, 'FAIL');
        results.teamCreation = 'FAIL';
        return false;
    }
}

// ============================================================================
// PART 2: ADMIN STREAK OVERRIDE VERIFICATION
// ============================================================================

async function verifyStreakOverride() {
    log('PART 2: ADMIN STREAK OVERRIDE VERIFICATION', 'SECTION');

    try {
        // 2A: Authorization tests
        log('2A: Authorization checks', 'INFO');

        // Test 1: Anonymous → 401
        const anonRes = await fetch(`${SUPABASE_URL}/functions/v1/admin-restore-streak`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_user_id: 'fake', new_streak: 5 })
        });

        if (anonRes.status === 401) {
            log('Anonymous request correctly rejected (401)', 'PASS');
        } else {
            log(`Anonymous request: ${anonRes.status} (expected 401)`, 'FAIL');
            results.issues.push('Admin endpoint does not reject anon');
        }

        // Test 2: Normal user → 403
        const normalUser = await createTestUser('streak_normal@test.com', 'user');
        const { session: normalSession } = await loginUser('streak_normal@test.com');

        const normalRes = await fetch(`${SUPABASE_URL}/functions/v1/admin-restore-streak`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${normalSession.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ target_user_id: normalUser.id, restore_streak_count: 5 })
        });

        if (normalRes.status === 403) {
            log('Normal user correctly rejected (403)', 'PASS');
        } else {
            log(`Normal user request: ${normalRes.status} (expected 403)`, 'FAIL');
            results.issues.push('Admin endpoint allows non-admin');
        }

        // Test 3: Admin → Success
        log('2B: Admin streak override', 'INFO');
        const adminUser = await createTestUser('streak_admin@test.com', 'admin');
        const { session: adminSession } = await loginUser('streak_admin@test.com');

        // Get target user current streak
        const targetUser = await createTestUser('streak_target@test.com', 'user');
        const { data: targetProfile } = await adminClient
            .from('profiles')
            .select('streak')
            .eq('id', targetUser.id)
            .single();

        const oldStreak = targetProfile?.streak || 0;
        const newStreak = oldStreak + 7;

        const adminRes = await fetch(`${SUPABASE_URL}/functions/v1/admin-restore-streak`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminSession.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ target_user_id: targetUser.id, restore_streak_count: newStreak })
        });

        if (adminRes.ok) {
            log('Admin streak override successful', 'PASS');

            // Verify streak was updated
            const { data: updatedProfile } = await adminClient
                .from('profiles')
                .select('streak')
                .eq('id', targetUser.id)
                .single();

            if (updatedProfile?.streak === newStreak) {
                log(`Streak correctly updated: ${oldStreak} → ${newStreak}`, 'PASS');
            } else {
                log(`Streak not updated correctly: ${updatedProfile?.streak}`, 'FAIL');
            }

            // 2C: Verify audit log
            log('2C: Audit log verification', 'INFO');
            const { data: auditLogs } = await adminClient
                .from('admin_audit_logs')
                .select('*')
                .eq('target_user_id', targetUser.id)
                .order('created_at', { ascending: false })
                .limit(1);

            if (auditLogs && auditLogs.length > 0) {
                const logEntry = auditLogs[0];
                log(`Audit log found: ID ${logEntry.id.substring(0, 8)}...`, 'PASS');

                if (logEntry.admin_user_id === adminUser.id) {
                    log('Audit log has correct admin_user_id', 'PASS');
                } else {
                    log('Audit log admin_user_id mismatch', 'FAIL');
                }
            } else {
                log('Audit log NOT written', 'FAIL');
                results.issues.push('Audit log missing for streak override');
            }

        } else {
            const errText = await adminRes.text();
            log(`Admin streak override failed: ${adminRes.status} - ${errText}`, 'FAIL');
            results.issues.push('Admin streak override failed');
        }

        // 2D: Idempotency test
        log('2D: Idempotency test', 'INFO');

        // Apply same streak again
        const idempotentRes = await fetch(`${SUPABASE_URL}/functions/v1/admin-restore-streak`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminSession.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ target_user_id: targetUser.id, new_streak: newStreak })
        });

        if (idempotentRes.ok) {
            const { data: finalProfile } = await adminClient
                .from('profiles')
                .select('streak')
                .eq('id', targetUser.id)
                .single();

            if (finalProfile?.streak === newStreak) {
                log('Idempotency maintained', 'PASS');
            } else {
                log('Streak corrupted by repeated override', 'FAIL');
                results.issues.push('Streak corruption on repeated override');
            }
        }

        results.streakOverride = results.issues.filter(i =>
            i.includes('streak') || i.includes('admin') || i.includes('Audit')
        ).length === 0 ? 'PASS' : 'FAIL';
        return results.streakOverride === 'PASS';

    } catch (error: any) {
        log(`Streak override verification error: ${error.message}`, 'FAIL');
        results.streakOverride = 'FAIL';
        return false;
    }
}

// ============================================================================
// PART 3: SECURITY & RLS CHECKS
// ============================================================================

async function verifySecurityRLS() {
    log('PART 3: SECURITY & RLS CHECKS', 'SECTION');

    try {
        // admin_audit_logs invisible to normal users
        const { data: anonLogs } = await anonClient.from('admin_audit_logs').select('*').limit(1);

        if (anonLogs && anonLogs.length > 0) {
            log('RLS FAIL: Anon can see audit logs', 'FAIL');
            results.issues.push('RLS allows anon audit log access');
        } else {
            log('Audit logs hidden from anon', 'PASS');
        }

        // Normal user cannot see audit logs
        const normalUser = await createTestUser('rls_normal@test.com', 'user');
        const { session } = await loginUser('rls_normal@test.com');

        const userClient = createClient(SUPABASE_URL!, ANON_KEY!, {
            global: { headers: { Authorization: `Bearer ${session.access_token}` } }
        });

        const { data: userLogs } = await userClient.from('admin_audit_logs').select('*').limit(1);

        if (userLogs && userLogs.length > 0) {
            log('RLS FAIL: Normal user can see audit logs', 'FAIL');
            results.issues.push('RLS allows user audit log access');
        } else {
            log('Audit logs hidden from normal users', 'PASS');
        }

        return true;
    } catch (error: any) {
        log(`Security/RLS check error: ${error.message}`, 'FAIL');
        return false;
    }
}

// ============================================================================
// MAIN DRIVER
// ============================================================================

async function runAudit() {
    console.log('\n' + '='.repeat(60));
    console.log('  TEAM CREATION & STREAK OVERRIDE AUDIT');
    console.log('  Date: ' + new Date().toISOString());
    console.log('='.repeat(60) + '\n');

    await verifyTeamCreation();
    await verifyStreakOverride();
    await verifySecurityRLS();

    // Final Report
    console.log('\n' + '='.repeat(60));
    console.log('  FINAL AUDIT REPORT');
    console.log('='.repeat(60));

    console.log('\n1. STATUS SUMMARY');
    console.log(`   Team Creation:   ${results.teamCreation === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Streak Override: ${results.streakOverride === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);

    if (results.issues.length > 0) {
        console.log('\n2. ISSUES DETECTED');
        results.issues.forEach((issue, i) => console.log(`   ${i + 1}. ❌ ${issue}`));
    } else {
        console.log('\n2. NO ISSUES DETECTED');
    }

    if (results.fixes.length > 0) {
        console.log('\n3. FIXES APPLIED');
        results.fixes.forEach((fix, i) => console.log(`   ${i + 1}. ✅ ${fix}`));
    }

    const passed = results.teamCreation === 'PASS' && results.streakOverride === 'PASS';
    console.log(`\nFINAL VERDICT: ${passed ? '✅ AUDIT PASSED' : '❌ AUDIT FAILED'}`);
    console.log('\n' + '='.repeat(60) + '\n');
}

runAudit();
