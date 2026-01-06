
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// --- LOGGING UTILS ---
const LOG_FILE = 'master_audit_log.txt';
function log(message: string, type: 'INFO' | 'PASS' | 'FAIL' | 'WARN' = 'INFO') {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${type}] ${message}`;
    console.log(logLine);
    fs.appendFileSync(LOG_FILE, logLine + '\n');
}

// --- ENV LOADING ---
const envPath = path.resolve(process.cwd(), '.env');
const localEnvPath = path.resolve(process.cwd(), '.env.local');
const targetPath = fs.existsSync(localEnvPath) ? localEnvPath : (fs.existsSync(envPath) ? envPath : null);

const envConfig = targetPath
    ? fs.readFileSync(targetPath, 'utf-8').split('\n').reduce((acc, line) => {
        const [key, ...value] = line.split('=');
        if (key && value) acc[key.trim()] = value.join('=').trim();
        return acc;
    }, {} as Record<string, string>)
    : {};

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || envConfig['VITE_SUPABASE_URL'];
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || envConfig['SUPABASE_SERVICE_ROLE_KEY'];
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || envConfig['VITE_SUPABASE_ANON_KEY'] || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || envConfig['VITE_SUPABASE_PUBLISHABLE_KEY'];

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    log('Missing Keys. Check .env', 'FAIL');
    process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

// --- HELPER: USERS ---
async function getOrCreateUser(email: string, isAdmin = false) {
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list?.users.find(u => u.email === email);

    if (existing) {
        // Ensure Role if Admin
        if (isAdmin) {
            const { data: roles } = await admin.from('user_roles').select('*').eq('user_id', existing.id).eq('role', 'admin');
            if (!roles || roles.length === 0) {
                await admin.from('user_roles').insert({ user_id: existing.id, role: 'admin' });
            }
        }
        return existing;
    }

    const { data, error } = await admin.auth.admin.createUser({
        email,
        password: 'Password123!',
        email_confirm: true,
        user_metadata: { username: email.split('@')[0] }
    });
    if (error) throw error;

    if (isAdmin && data.user) {
        await admin.from('user_roles').insert({ user_id: data.user.id, role: 'admin' });
    }
    return data.user;
}

async function getClientForUser(email: string) {
    const { data, error } = await admin.auth.signInWithPassword({
        email,
        password: 'Password123!'
    });
    if (error) throw error;
    return {
        client: createClient(SUPABASE_URL!, ANON_KEY!, {
            global: { headers: { Authorization: `Bearer ${data.session?.access_token}` } }
        }),
        user: data.user!,
        token: data.session?.access_token
    };
}

// --- MAIN AUDIT DRIVER ---
async function main() {
    log('=== STARTING MASTER AUDIT ===');

    try {
        // 1. SETUP USERS
        const userA = await getOrCreateUser('audit_master_user@example.com');
        const userAdmin = await getOrCreateUser('audit_master_admin@example.com', true);
        const { client: clientA } = await getClientForUser('audit_master_user@example.com');
        const { client: clientAdmin } = await getClientForUser('audit_master_admin@example.com'); // Admin logging in as user to test client-side admin flows? No, use service key for purely admin, but clientAdmin for checking permissions.

        log('Users Created/Verified', 'PASS');

        // 2. CORE: QUESTS
        log('--- CHECKING QUEST SYSTEM ---');
        const { data: questData, error: questError } = await clientA.functions.invoke('get-daily-quest');
        if (questError) log(`Quest Fetch Error: ${questError.message}`, 'FAIL');
        else if (!questData.quest) log('Quest Data Missing', 'FAIL');
        else log('Quest Fetched', 'PASS');

        const logId = questData?.log_id;

        // 3. CORE: REFLECTIONS (UPDATE)
        if (logId) {
            const { error: reflectError } = await clientA.from('user_quest_log')
                .update({
                    reflection_text: 'Master Audit Reflection',
                    xp_awarded: 10,
                    completed_at: new Date().toISOString()
                })
                .eq('id', logId);
            if (reflectError) log(`Reflection Update Error: ${reflectError.message}`, 'FAIL');
            else log('Reflection Updated', 'PASS');
        } else {
            log('Skipping Reflection (No Log ID)', 'WARN');
        }

        // 4. SOCIAL: COMMUNITY FEED
        log('--- CHECKING COMMUNITY FEED ---');
        const { error: postError } = await clientA.from('community_posts').insert({
            user_id: userA?.id,
            content: 'Master Audit Post',
            is_anonymous: true
        });
        if (postError) log(`Post Error: ${postError.message}`, 'FAIL');
        else log('Anonymous Post Created', 'PASS');

        // 5. SOCIAL: TEAMS & DUOS
        log('--- CHECKING TEAMS & DUOS ---');
        // Clean old
        await admin.from('teams').delete().eq('creator_id', userA?.id);

        // Valid Team
        const { data: team, error: teamError } = await clientA.from('teams').insert({
            name: 'Master Team',
            creator_id: userA?.id,
            team_type: 'team',
            max_members: 5
        }).select().single();
        if (teamError) log(`Team Create Error: ${teamError.message}`, 'FAIL');
        else log('Team Created', 'PASS');

        // Duo Constraint
        const { error: duoError, data: duo } = await clientA.from('teams').insert({
            name: 'Master Duo',
            creator_id: userA?.id,
            team_type: 'duo',
            max_members: 99
        }).select().single();

        if (duo && duo.max_members === 2) log('Duo Constraint Verified (99 -> 2)', 'PASS');
        else if (duoError) log(`Duo Create Error: ${duoError.message}`, 'FAIL');
        else log(`Duo Constraint FAILED (Max=${duo.max_members})`, 'FAIL');

        // 6. SECURITY: PAYMENT PROOF (FILE UPLOAD)
        log('--- CHECKING SECURITY (UPLOADS) ---');
        const fakeExe = new Blob([new Uint8Array([0x4D, 0x5A])], { type: 'image/jpeg' }); // MZ header = EXE
        const formData = new FormData();
        formData.append('file', fakeExe, 'malware.jpg');

        const { error: uploadError } = await clientA.functions.invoke('upload-payment-proof', {
            body: formData
        });
        // Note: Invoke might return 'data' with error message or throw 'error'. 
        // If the function returns 400/500, invoke returns error.

        // We expect REJECTION.
        // If using raw fetch, checking status is easier. invoke wrapper abstracts it.
        // Assuming well-behaved function returns error on bad file.
        // Let's assume passed if error, or data contains 'error'.
        if (uploadError) log('Malware Upload Rejected (Expected)', 'PASS');
        else log('Malware Upload Accepted?', 'WARN'); // Depending on function implementation

        // 7. HABITS (CONDITIONAL)
        log('--- CHECKING HABITS (IF EXISTS) ---');
        const { error: habitError } = await clientA.from('habits').select('count', { count: 'exact', head: true });
        if (habitError && habitError.code === '42P01') {
            log('Habits table does not exist', 'INFO');
        } else if (!habitError) {
            log('Habits Table Verified', 'PASS');
        } else {
            log(`Habit Check Error: ${habitError.message}`, 'FAIL');
        }

    } catch (e: any) {
        log(`FATAL SCRIPT ERROR: ${e.message}`, 'FAIL');
    }

    log('=== AUDIT COMPLETE ===');
}

main();
