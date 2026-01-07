
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// 1. Load Environment Variables
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
    console.error('❌ Mismatched Keys. Check .env');
    process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

// Utility: Create User
async function getOrCreateUser(email: string) {
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list?.users.find(u => u.email === email);
    if (existing) return existing;

    const { data, error } = await admin.auth.admin.createUser({
        email,
        password: 'Password123!',
        email_confirm: true,
        user_metadata: { username: email.split('@')[0] }
    });
    if (error) throw error;
    return data.user;
}

// Utility: Client as User
async function getClientForUser(email: string) {
    const { data, error } = await admin.auth.signInWithPassword({
        email,
        password: 'Password123!'
    });
    if (error) throw error;

    return {
        client: createClient(SUPABASE_URL, ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${data.session?.access_token}` } }
        }),
        user: data.user,
        token: data.session?.access_token
    };
}

async function audit() {
    console.log('🛡️  STARTING PRODUCTION AUDIT 🛡️\n');
    const errors: string[] = [];
    const pass = (msg: string) => console.log(`✅ ${msg}`);
    const fail = (msg: string) => { console.error(`❌ ${msg}`); errors.push(msg); };

    try {
        // --- 1. AUTH & PROFILE ---
        try {
            console.log('--- 1. AUTH & PROFILE ---');
            const userA = await getOrCreateUser('audit_user_a@example.com');
            const { client: clientA, token } = await getClientForUser('audit_user_a@example.com');

            // Check Profile (Trigger should create it)
            const { data: profile } = await clientA.from('profiles').select('*').single();
            if (profile && profile.id === userA.id) pass('Profile auto-created');
            else fail('Profile creation trigger failed');

            // --- 2. QUEST SYSTEM ---
            let logId: string | null = null;
            try {
                console.log('\n--- 2. QUEST SYSTEM ---');
                const { data: questData, error: questError } = await clientA.functions.invoke('get-daily-quest');
                if (questError) {
                    fail(`Quest Fetch Failed: ${questError.message}`);
                } else {
                    if (questData.quest) {
                        pass('Daily Quest Fetched');
                        logId = questData.log_id;
                        if (logId) pass('Quest Log ID Retrieved');
                        else fail('Quest Log ID missing in response');
                    }
                    else fail('Daily Quest returned empty payload');
                }
            } catch (e: any) { fail(`Quest System Crash: ${e.message}`); }

            // --- 3. REFLECTIONS ---
            if (logId) {
                try {
                    console.log('\n--- 3. REFLECTIONS (Update) ---');
                    const { error: reflectError } = await clientA.from('user_quest_log')
                        .update({
                            reflection_text: 'Audit reflection text',
                            xp_awarded: 10,
                            completed_at: new Date().toISOString()
                        })
                        .eq('id', logId);

                    if (reflectError) fail(`Reflection Update Failed: ${reflectError.message}`);
                    else pass('Reflection Updated (Quest Completed)');
                } catch (e: any) { fail(`Reflection Crash: ${e.message}`); }
            } else {
                console.log('\n--- 3. REFLECTIONS (Skipped - No Log ID) ---');
                // Consider this a fail for the flow
                fail('Reflection Flow Blocked (Dependency)');
            }

            // --- 4. COMMUNITY FEED ---
            try {
                console.log('\n--- 4. COMMUNITY FEED ---');
                const { error: postError } = await clientA.from('community_posts').insert({
                    user_id: userA.id,
                    content: 'Audit Post Content',
                    is_anonymous: true
                });
                if (postError) fail(`Community Post Failed: ${postError.message}`);
                else pass('Community Post Created');
            } catch (e: any) { fail(`Community Crash: ${e.message}`); }

            // --- 5. TEAMS & DUOS ---
            try {
                console.log('\n--- 5. TEAMS & DUOS ---');
                // Clean up previous test teams
                await admin.from('teams').delete().eq('creator_id', userA.id);

                // Create Team
                const { data: team, error: teamError } = await clientA.from('teams').insert({
                    name: 'Audit Team',
                    creator_id: userA.id,
                    team_type: 'team',
                    max_members: 5
                }).select().single();

                if (teamError) fail(`Team Creation Failed: ${teamError.message}`);
                else {
                    pass('Team Created');
                    // Verify Trigger (Creator Member)
                    const { data: mems } = await admin.from('team_members').select('*').eq('team_id', team.id);
                    if (mems?.length === 1) pass('Creator Auto-Added to Team');
                    else fail(`Creator NOT added to team (Count: ${mems?.length})`);
                }

                // Create Duo (Constraint Check)
                const { data: duo, error: duoError } = await clientA.from('teams').insert({
                    name: 'Audit Duo',
                    creator_id: userA.id,
                    team_type: 'duo',
                    max_members: 100 // Malicious attempt
                }).select().single();

                if (duoError) fail(`Duo Creation Failed: ${duoError.message}`);
                else {
                    if (duo.max_members === 2) pass('Duo Constraint Enforced (Max=100 -> 2)');
                    else fail(`Duo Constraint FAILED (Max=${duo.max_members})`);
                }
            } catch (e: any) { fail(`Teams Crash: ${e.message}`); }

        } catch (e: any) {
            fail(`FATAL AUTH CRASH: ${e.message}`);
        }

    } catch (e: any) {
        fail(`FATAL EXCEPTION: ${e.message}`);
    }

    console.log('\n--- AUDIT SUMMARY ---');
    if (errors.length === 0) {
        console.log('✅✅ ALL SYSTEMS GO. PRODUCTION READY. ✅✅');
    } else {
        console.log(`❌ FOUND ${errors.length} ISSUES ❌`);
        errors.forEach(e => console.log(` - ${e}`));
    }
}

audit();
