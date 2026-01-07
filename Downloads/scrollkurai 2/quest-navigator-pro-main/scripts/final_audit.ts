
import pkg from '@supabase/supabase-js';
const { createClient } = pkg;
type SupabaseClient = ReturnType<typeof createClient>;
import * as fs from 'fs';
import * as path from 'path';

// --- Configuration & Setup ---
const LOG_FILE = 'audit_log_output.txt';

function log(message: string, type: 'INFO' | 'PASS' | 'FAIL' | 'WARN' = 'INFO') {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${type}] ${message}`;
    console.log(logLine);
    fs.appendFileSync(LOG_FILE, logLine + '\n');
}

// Load env vars manually
const envPath = path.resolve(process.cwd(), '.env');
const envConfig = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, 'utf-8').split('\n').reduce((acc, line) => {
        const [key, ...value] = line.split('=');
        if (key && value) {
            acc[key.trim()] = value.join('=').trim();
        }
        return acc;
    }, {} as Record<string, string>)
    : {};

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || envConfig['VITE_SUPABASE_URL'];
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || envConfig['VITE_SUPABASE_PUBLISHABLE_KEY'];
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || envConfig['SUPABASE_SERVICE_ROLE_KEY'];

// --- Helper Functions ---
async function createTestUser(adminClient: SupabaseClient, email: string, role: 'user' | 'admin' = 'user') {
    const { data: users } = await adminClient.auth.admin.listUsers();
    const existing = users?.users.find(u => u.email === email);
    if (existing) {
        // If we delete the user, we lose their ID refs. For audit re-runs, maybe keep them?
        // But clean state is better.
        // However, fast re-runs might fail rate limits on signup.
        // Let's reuse if exists, but ensure role.

        // Ensure role
        if (role === 'admin') {
            // Check if already admin
            const { data: roles } = await adminClient.from('user_roles').select('*').eq('user_id', existing.id).eq('role', 'admin');
            if (!roles || roles.length === 0) {
                await adminClient.from('user_roles').insert({ user_id: existing.id, role: 'admin' });
            }
        }
        return existing;
    }

    const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password: 'password123',
        email_confirm: true,
        user_metadata: { username: role === 'admin' ? 'AdminUser' : 'NormalUser' }
    });

    if (error || !data.user) throw new Error(`Failed to create test user ${email}: ${error?.message}`);

    // Set Role
    if (role === 'admin') {
        await adminClient.from('user_roles').insert({ user_id: data.user.id, role: 'admin' });
    }

    return data.user;
}

async function loginUser(email: string) {
    const client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
    const { data, error } = await client.auth.signInWithPassword({
        email,
        password: 'password123'
    });
    if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
    return { client, session: data.session, user: data.user! };
}

// --- Phase 1: Environment ---
async function checkEnvironment() {
    log('--- PHASE 1: BOOT & ENVIRONMENT ---');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        log('Missing credentials', 'FAIL');
        process.exit(1);
    }
    log(`Supabase URL: ${SUPABASE_URL}`);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
    log(error ? `Connection Failed: ${error.message}` : 'Supabase Connection Successful', error ? 'FAIL' : 'PASS');
    return supabase;
}

// --- Phase 2: Database & Schema ---
async function checkSchema(supabase: SupabaseClient) {
    log('--- PHASE 2: DATABASE & SCHEMA AUDIT ---');

    const tables = ['quests', 'habits', 'admin_audit_logs', 'leaderboard_cache', 'counselling_requests', 'premium_lessons'];
    for (const t of tables) {
        const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
        if (error?.code === '42P01') log(`Missing Table: ${t}`, 'FAIL');
        else log(`Verified Table: ${t} (Rows: ${count})`, count === 0 ? 'WARN' : 'PASS');
    }

    log('Verifying RLS on admin_audit_logs...');
    try {
        const adminUser = await createTestUser(supabase, 'audit_admin_rls@test.com', 'admin');
        const logEntry = {
            admin_user_id: adminUser.id,
            action: 'AUDIT_TEST_RLS',
            target_type: 'test',
            metadata: { test: true }
        };

        const { error: insertError } = await supabase.from('admin_audit_logs').insert(logEntry);
        if (insertError) log(`Setup Error (Insert Admin Log): ${insertError.message}`, 'WARN');

        const anonClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
        const { data: anonData } = await anonClient.from('admin_audit_logs').select('*');

        if (anonData && anonData.length > 0) log('RLS FAILURE: Anon user can see admin logs!', 'FAIL');
        else log('RLS SUCCESS: Anon user cannot see admin logs', 'PASS');
    } catch (e: any) {
        log(`RLS Test Setup Exception: ${e.message}`, 'WARN');
    }
}

// --- Phase 3: Auth & RBAC ---
async function checkAuth(supabase: SupabaseClient) {
    log('--- PHASE 3: AUTH & RBAC ---');
    try {
        await createTestUser(supabase, 'normal_user@test.com', 'user');
        await createTestUser(supabase, 'admin_user@test.com', 'admin');
        log('Test Users Created', 'PASS');

        await loginUser('normal_user@test.com');
        log('JWT Login Verified', 'PASS');

        // RBAC check: Normal user attempting admin action
        // We will try this in Phase 5 too, but checking admin log read here
        const { client: userClient } = await loginUser('normal_user@test.com');
        const { data: rbacData } = await userClient.from('admin_audit_logs').select('*');
        if (rbacData && rbacData.length > 0) log('RBAC FAIL: User accessed admin logs', 'FAIL');
        else log('RBAC PASS: User blocked from admin logs', 'PASS');
    } catch (e: any) {
        log(`Auth Audit Failed: ${e.message}`, 'FAIL');
    }
}

// --- Phase 4A: Habits ---
async function checkHabits(supabase: SupabaseClient) {
    log('--- PHASE 4A: HABITS FLOW ---');
    try {
        const { user, client } = await loginUser('normal_user@test.com');
        const { data: habit, error: createError } = await client
            .from('habits')
            .insert({ user_id: user.id, title: 'Test Habit', frequency: ['Mon'] })
            .select()
            .single();

        if (createError) {
            log(`Habit Creation Failed: ${createError.message}`, 'FAIL');
            return;
        }
        log('Habit Creation Verified', 'PASS');

        const { error: logError } = await client
            .from('habit_logs')
            .insert({ habit_id: habit.id, user_id: user.id, completed_at: new Date().toISOString() });

        if (logError) log(`Habit Completion Failed: ${logError.message}`, 'FAIL');
        else log('Habit Completion Verified', 'PASS');
    } catch (e: any) {
        log(`Habit Test Failed: ${e.message}`, 'FAIL');
    }
}

// --- Phase 4B: Leaderboards ---
async function checkLeaderboards(supabase: SupabaseClient) {
    log('--- PHASE 4B: LEADERBOARDS ---');
    try {
        const { client } = await loginUser('normal_user@test.com');
        // Call RPC
        const { data, error } = await client.rpc('get_league_leaderboard', { league_tier_param: 'bronze' });

        if (error) {
            log(`Leaderboard RPC Failed: ${error.message}`, 'FAIL');
        } else {
            log(`Leaderboard RPC Successful (Rows: ${data?.length || 0})`, 'PASS');
        }
    } catch (e: any) {
        log(`Leaderboard Test Failed: ${e.message}`, 'FAIL');
    }
}

// --- Phase 4C: Video Courses ---
async function checkVideoCourses(supabase: SupabaseClient) {
    log('--- PHASE 4C: VIDEO COURSES ---');
    try {
        const { user: freeUser, client: freeClient } = await loginUser('normal_user@test.com');
        const { client: adminClient } = await loginUser('admin_user@test.com'); // assuming admin role for create

        // Create Lesson via Admin Client (Service Role for simplicity in test setup, but could use adminClient if policies allow)
        const { data: lesson, error: setupError } = await supabase.from('premium_lessons').insert({
            title: 'Audit Lesson', description: 'Test', video_url: 'http://test.com', duration_minutes: 10, category: 'test'
        }).select().single();

        if (setupError) {
            log(`Video Setup Failed: ${setupError.message}`, 'WARN');
            return;
        }

        // Free User Access Check
        // Usually restricted via RLS or logic.
        const { data: access } = await freeClient.from('premium_lessons').select('*').eq('id', lesson.id);
        if (access && access.length > 0) {
            log('Free User Visibility: Allowed (Catalog View)', 'INFO');
            // Note: If they can see the video_url, that might be a risk, but often titles are visible.
        } else {
            log('Free User Visibility: Blocked', 'PASS');
        }

        // Progress Tracking
        const { error: progError } = await freeClient.from('lesson_progress').insert({
            user_id: freeUser.id, lesson_id: lesson.id, progress_percent: 50
        });

        if (progError) log(`Progress Tracking Failed: ${progError.message}`, 'FAIL');
        else log('Progress Tracking Verified', 'PASS');

    } catch (e: any) {
        log(`Video Courses Test Failed: ${e.message}`, 'FAIL');
    }
}

// --- Phase 4D: Counselling ---
async function checkCounselling(supabase: SupabaseClient) {
    log('--- PHASE 4D: COUNSELLING ---');
    try {
        const { user: normalUser, client: normalClient } = await loginUser('normal_user@test.com');

        // Create Request
        const { data: req, error: createError } = await normalClient
            .from('counselling_requests')
            .insert({
                user_id: normalUser.id,
                concern_summary: 'Audit Test',
                status: 'pending' // Default, but explicitly checking
            })
            .select()
            .single();

        if (createError) {
            log(`Counselling Request Create Failed: ${createError.message}`, 'FAIL');
            return;
        }
        log('Counselling Request Created', 'PASS');

        // Admin Approval
        // Use service role or admin user
        const { user: adminUser, client: adminClient } = await loginUser('admin_user@test.com');

        const { error: updateError } = await adminClient
            .from('counselling_requests')
            .update({ status: 'confirmed', admin_notes: 'Approved via Audit' })
            .eq('id', req.id);

        if (updateError) log(`Admin Approval Failed: ${updateError.message}`, 'FAIL');
        else log('Admin Approval Verified', 'PASS');

    } catch (e: any) {
        log(`Counselling Test Failed: ${e.message}`, 'FAIL');
    }
}

// --- Phase 4E: AI Features ---
async function checkAI(supabase: SupabaseClient) {
    log('--- PHASE 4E: AI FEATURES ---');
    try {
        const { client } = await loginUser('normal_user@test.com');
        // Invoke Edge Function
        // Note: For this to work efficiently in audit, we check if it responds. 
        // We probably don't want to burn real tokens or latency, so just a ping or simple prompt.

        const { data, error } = await client.functions.invoke('generate-with-gemini', {
            body: { prompt: 'Hello', systemPrompt: 'Reply with "OK"' }
        });

        if (error) {
            log(`AI Function Invoke Failed: ${error.message}`, 'FAIL');
        } else {
            // If we get specific result
            log(`AI Function Response Received`, 'PASS');
        }
    } catch (e: any) {
        log(`AI Test Failed: ${e.message}`, 'FAIL');
    }
}

// --- Phase 4F: Daily Quest Fix ---
async function checkDailyQuests(supabase: SupabaseClient) {
    log('--- PHASE 4F: DAILY QUEST FIX CHECK ---');
    try {
        const { client } = await loginUser('normal_user@test.com');

        // 1. Auto-Heal: Request for Today (Local Date)
        const today = new Date().toISOString().split('T')[0];
        log(`Requesting Quest for Date: ${today}`);

        const session = (await client.auth.getSession()).data.session;
        const functionUrl = `${SUPABASE_URL}/functions/v1/get-daily-quest`;

        const r1 = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${session?.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ date: today })
        });

        const t1 = await r1.text();
        if (!r1.ok) {
            log(`Daily Quest Request Failed: ${r1.status} ${r1.statusText}`, 'FAIL');
            log(`Response Body: ${t1}`, 'WARN');
            return;
        }

        let q1: any;
        try {
            q1 = JSON.parse(t1);
        } catch {
            log('Failed to parse JSON response', 'FAIL');
            return;
        }

        if (q1.quest && q1.date === today && q1.log_id) {
            log('Auto-Heal Success: Quest Generated', 'PASS');
        } else {
            log(`Auto-Heal Verification Failed: ${JSON.stringify(q1)}`, 'FAIL');
        }

        const firstLogId = q1.log_id;

        // 2. Idempotency: Request again
        const { data: q2 } = await client.functions.invoke('get-daily-quest', {
            body: { date: today }
        });

        if (q2.log_id === firstLogId) {
            log('Idempotency Verified: Same Log ID returned', 'PASS');
        } else {
            log('Idempotency Failed: Duplicate created?', 'FAIL');
        }

        // 3. Timezone: Tomorrow
        const tmr = new Date();
        tmr.setDate(tmr.getDate() + 1);
        const tmrStr = tmr.toISOString().split('T')[0];

        const { data: q3 } = await client.functions.invoke('get-daily-quest', {
            body: { date: tmrStr }
        });

        if (q3.date === tmrStr && q3.log_id !== firstLogId) {
            log('Timezone Logic Verified: Different quest for date', 'PASS');
        } else {
            log('Timezone Logic Failed', 'FAIL');
        }

    } catch (e: any) {
        log(`Daily Quest Check Exception: ${e.message}`, 'FAIL');
    }
}

// --- Phase 5: Payment Proof Security ---
async function checkPaymentProofs(supabase: SupabaseClient) {
    log('--- PHASE 5: PAYMENT PROOF UPLOAD SECURITY ---');
    try {
        const { session } = await loginUser('normal_user@test.com');

        async function testUpload(fileName: string, content: Buffer, mimeType: string, description: string) {
            log(`Testing Upload: ${description}...`);
            const blob = new Blob([new Uint8Array(content)], { type: mimeType });
            const formData = new FormData();
            formData.append('file', blob, fileName);

            const res = await fetch(`${SUPABASE_URL}/functions/v1/upload-payment-proof`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`
                },
                body: formData
            });

            const text = await res.text();

            if (res.status === 200) {
                log(`Upload Accepted: ${description}`, 'INFO'); // Might be PASS or FAIL depending on test
                return true;
            } else {
                log(`Upload Rejected (${res.status}): ${description}`, 'INFO');
                return false;
            }
        }

        // 1. Valid PNG
        const validPng = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        const r1 = await testUpload('valid.png', validPng, 'image/png', 'Valid PNG');
        if (r1) log('Valid PNG Accepted', 'PASS');
        else log('Valid PNG Rejected (Unexpected)', 'FAIL');

        // 2. Fake JPG (EXE)
        const fakeJpg = Buffer.from([0x4D, 0x5A, 0x90, 0x00]);
        const r2 = await testUpload('malware.jpg', fakeJpg, 'image/jpeg', 'EXE renamed to JPG');
        if (!r2) log('Malware Rejected', 'PASS');
        else log('Malware Accepted (SECURITY FAIL)', 'FAIL');

        // 3. Oversized
        const bigFile = Buffer.alloc(1048576 + 10, 0);
        const r3 = await testUpload('big.jpg', bigFile, 'image/jpeg', 'Oversized File');
        if (!r3) log('Oversized File Rejected', 'PASS');
        else log('Oversized File Accepted (SECURITY FAIL)', 'FAIL');

        // 4. PDF
        const pdf = Buffer.from('%PDF-1.5');
        const r4 = await testUpload('doc.pdf', pdf, 'application/pdf', 'PDF File');
        if (!r4) log('PDF Rejected', 'PASS');
        else log('PDF Accepted (SECURITY FAIL)', 'FAIL');

    } catch (e: any) {
        log(`Payment Proof Audit Failed: ${e.message}`, 'FAIL');
    }
}

// --- Phase 6: Admin & Failure ---
async function checkAdminAndFailure(supabase: SupabaseClient) {
    log('--- PHASE 6: ADMIN & FAILURE ---');

    // Test manage-user-roles via Function
    const { client: adminClient } = await loginUser('admin_user@test.com');
    const { user: targetUser } = await loginUser('normal_user@test.com');

    // Simulate Failure: Bad Params
    const { error: failError } = await adminClient.functions.invoke('manage-user-roles', {
        body: { invalid: true }
    });
    // We expect some error handling or verification failure
    if (failError) log('Failure handling verified (Bad Params)', 'PASS');
    else log('Bad params accepted (Unexpected)', 'WARN');

    // Valid Role Assign
    const { error: roleError } = await adminClient.from('user_roles').insert({
        user_id: targetUser.id, role: 'moderator'
    });

    if (roleError) log(`Role Assignment Failed: ${roleError.message}`, 'FAIL'); // Might fail if already exists
    else log('Role Assignment Verified', 'PASS');
}

// --- Driver ---
async function runAudit() {
    try {
        const supabase = await checkEnvironment();
        await checkSchema(supabase);
        await checkAuth(supabase);
        await checkHabits(supabase);
        await checkLeaderboards(supabase);
        await checkVideoCourses(supabase);
        await checkCounselling(supabase);
        await checkDailyQuests(supabase);
        await checkAI(supabase);
        await checkPaymentProofs(supabase);
        await checkAdminAndFailure(supabase);

        log('--- AUDIT COMPLETE ---', 'INFO');
    } catch (error) {
        log(`Critical Audit Failure: ${error}`, 'FAIL');
        console.error(error);
    }
}

runAudit();
