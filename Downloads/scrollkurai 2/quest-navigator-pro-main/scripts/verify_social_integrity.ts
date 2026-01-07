
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load env
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
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || envConfig['VITE_SUPABASE_ANON_KEY'] || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || envConfig['VITE_SUPABASE_PUBLISHABLE_KEY'];

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    console.error('Missing Required Keys:', {
        URL: !!SUPABASE_URL,
        SERVICE: !!SERVICE_KEY,
        ANON: !!ANON_KEY
    });
    process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

async function createTestUser(email: string) {
    // Delete if exists first to be clean
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list?.users.find(u => u.email === email);
    if (existing) {
        await admin.auth.admin.deleteUser(existing.id);
    }

    // Create
    const { data, error } = await admin.auth.admin.createUser({
        email,
        password: 'password123',
        email_confirm: true
    });

    if (error) throw error;
    return data.user;
}

async function main() {
    console.log('=== STARTING SOCIAL INTEGRITY AUDIT ===\n');

    try {
        // 1. Setup Users
        console.log('1. Setting up test users...');
        const userA = await createTestUser('test_social_a@example.com'); // Creator
        const userB = await createTestUser('test_social_b@example.com'); // Member
        const userC = await createTestUser('test_social_c@example.com'); // Excess Member

        if (!userA || !userB || !userC) throw new Error('Failed to create users');
        console.log('   Users created: A, B, C');

        // Impersonate User A (using admin client but logically acting as A)
        // Note: For RLS testing we really need a client with User A's token.
        // We can sign in to get tokens.

        const signIn = async (email: string) => {
            const { data } = await admin.auth.signInWithPassword({
                email,
                password: 'password123'
            });
            return createClient(SUPABASE_URL, ANON_KEY, {
                global: { headers: { Authorization: `Bearer ${data.session?.access_token}` } }
            });
        };

        const clientA = await signIn('test_social_a@example.com');
        const clientB = await signIn('test_social_b@example.com');
        const clientC = await signIn('test_social_c@example.com');

        // 2. Test Team Creation (Standard)
        console.log('\n2. Testing Team Creation (Standard)...');
        // Simulate client-side logic: Insert Team -> Insert Member
        const teamName = `Team-${Date.now()}`;
        const { data: team, error: createError } = await clientA.from('teams').insert({
            name: teamName,
            creator_id: userA.id,
            team_type: 'team',
            max_members: 5
        }).select().single();

        if (createError) throw new Error(`Team insert failed: ${createError.message}`);
        console.log(`   Team created: ${team.id}`);

        // Verify Trigger: User A should ALREADY be in team_members
        const { data: membersCheck } = await admin.from('team_members').select('*').eq('team_id', team.id);
        console.log(`   Members after team insert (expect 1 via trigger): ${membersCheck?.length}`);

        // Simulate Client Logic: Try to insert creator again
        const { error: memberInsertError } = await clientA.from('team_members').insert({
            team_id: team.id,
            user_id: userA.id,
            role: 'creator'
        });

        if (memberInsertError) {
            console.log(`   [EXPECTED/UNEXPECTED] Client member insert failed: ${memberInsertError.message}`);
            // If code corresponds to "duplicate key", it confirms trigger works but client logic is partial.
        } else {
            console.log(`   [WARNING] Client member insert succeeded. Duplicate? or Trigger failed?`);
        }

        // 3. Test Duo Creation Malformed
        console.log('\n3. Testing Duo Creation Constraints...');
        const duoName = `Duo-${Date.now()}`;
        // Try to create DUO with max_members = 100
        const { data: duo, error: duoError } = await clientA.from('teams').insert({
            name: duoName,
            creator_id: userA.id,
            team_type: 'duo',
            max_members: 100 // Malicious payload
        }).select().single();

        if (duoError) throw new Error(`Duo insert failed: ${duoError.message}`);

        // Verify if database forced it to 2 or accepted 100
        const { data: duoCheck } = await admin.from('teams').select('max_members').eq('id', duo.id).single();
        console.log(`   Duo max_members (Request: 100, Actual: ${duoCheck?.max_members})`);

        if (duoCheck?.max_members === 100) {
            console.error('   ❌ FAILED: Database accepted max_members=100 for Duo');
        } else {
            console.log('   ✅ PASSED: Database enforced max_members');
        }

        // 4. Test Joining Duo
        console.log('\n4. Testing Duo Joining (Capacity)...');
        // User A is owner.
        // User B joins.
        // First, check RLS: Can User B insert themselves? (Usually requires invite or public team)
        // Assuming public for now or invite system.
        // We will insert 'pending' invite first if needed, or straight insert if RLS allows 'join'.

        // Try direct insert for B
        const { error: joinBError } = await clientB.from('team_members').insert({
            team_id: duo.id,
            user_id: userB.id,
            role: 'member'
        });

        if (joinBError) console.log(`   User B Join Result: ${joinBError.message}`);
        else console.log('   User B Join: Success');

        // Try User C insert (Should fail if capacity check exists)
        const { error: joinCError } = await clientC.from('team_members').insert({
            team_id: duo.id,
            user_id: userC.id,
            role: 'member'
        });

        if (joinCError) console.log(`   User C Join Result (Expect Fail): ${joinCError.message}`);
        else console.log('   User C Join: Success (Potential Overflow)');

        const { count: finalDuoCount } = await admin.from('team_members').select('*', { count: 'exact', head: true }).eq('team_id', duo.id);
        console.log(`   Final Duo Count: ${finalDuoCount}/2`);

        // Cleanup
        console.log('\nCleaning up...');
        await admin.from('teams').delete().in('id', [team.id, duo.id]);
        await admin.auth.admin.deleteUser(userA.id);
        await admin.auth.admin.deleteUser(userB.id);
        await admin.auth.admin.deleteUser(userC.id);
        console.log('Done.');

    } catch (err: any) {
        console.error('FATAL AUDIT ERROR:', err);
    }
}

main();
