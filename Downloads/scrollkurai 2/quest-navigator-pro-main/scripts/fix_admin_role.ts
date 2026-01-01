import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const envConfig = fs.readFileSync(envPath, 'utf-8').split('\n').reduce((acc, line) => {
    const [key, ...value] = line.split('=');
    if (key && value) acc[key.trim()] = value.join('=').trim();
    return acc;
}, {} as Record<string, string>);

const admin = createClient(envConfig['VITE_SUPABASE_URL']!, envConfig['SUPABASE_SERVICE_ROLE_KEY']!);

async function main() {
    console.log('=== FIXING ADMIN ROLE ===');

    // 1. Check user_roles table structure
    const { data: roles, error: rolesErr } = await admin.from('user_roles').select('*');
    console.log('Current user_roles count:', roles?.length || 0);
    if (rolesErr) console.log('Roles error:', rolesErr.message);

    // 2. Find test admin user
    const { data: users } = await admin.auth.admin.listUsers();
    const testAdmin = users?.users?.find(u => u.email === 'audit_admin@test.com');

    if (!testAdmin) {
        console.log('❌ audit_admin@test.com not found');
        return;
    }

    console.log('Test admin ID:', testAdmin.id);

    // 3. Check if already has role
    const { data: existingRole } = await admin.from('user_roles')
        .select('*')
        .eq('user_id', testAdmin.id)
        .maybeSingle();

    console.log('Existing role:', existingRole);

    // 4. If no role, insert
    if (!existingRole) {
        const { error: insertErr } = await admin.from('user_roles')
            .insert({ user_id: testAdmin.id, role: 'admin' });

        if (insertErr) {
            console.log('❌ Insert error:', insertErr.message);
        } else {
            console.log('✅ Admin role inserted');
        }
    } else if (existingRole.role !== 'admin') {
        // Update role to admin
        const { error: updateErr } = await admin.from('user_roles')
            .update({ role: 'admin' })
            .eq('user_id', testAdmin.id);

        if (updateErr) {
            console.log('❌ Update error:', updateErr.message);
        } else {
            console.log('✅ Role updated to admin');
        }
    } else {
        console.log('✅ Already has admin role');
    }

    // 5. Verify has_role RPC
    const { data: hasRoleResult, error: rpcErr } = await admin.rpc('has_role', {
        _user_id: testAdmin.id,
        _role: 'admin'
    });

    console.log('has_role RPC result:', hasRoleResult);
    if (rpcErr) console.log('RPC error:', rpcErr.message);

    // 6. Test the admin-restore-streak endpoint
    console.log('\n=== TESTING ADMIN ENDPOINT ===');

    const anonClient = createClient(
        envConfig['VITE_SUPABASE_URL']!,
        envConfig['VITE_SUPABASE_PUBLISHABLE_KEY']!
    );

    const { data: session, error: loginErr } = await anonClient.auth.signInWithPassword({
        email: 'audit_admin@test.com',
        password: 'password123'
    });

    if (loginErr) {
        console.log('❌ Login error:', loginErr.message);
        return;
    }

    console.log('✅ Logged in as admin');

    // Find a test target user
    const { data: targetUser } = await admin.from('profiles')
        .select('id, username, streak')
        .neq('id', testAdmin.id)
        .limit(1)
        .single();

    if (!targetUser) {
        console.log('❌ No target user found');
        return;
    }

    console.log('Target user:', targetUser.id, 'current streak:', targetUser.streak);

    const res = await fetch(`${envConfig['VITE_SUPABASE_URL']}/functions/v1/admin-restore-streak`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${session.session?.access_token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            target_user_id: targetUser.id,
            restore_streak_count: 5,
            reason: 'Audit verification test'
        })
    });

    const result = await res.json();
    console.log('Response:', res.status, JSON.stringify(result));

    if (res.ok) {
        console.log('✅ ADMIN STREAK OVERRIDE WORKING');
    } else {
        console.log('❌ ADMIN STREAK OVERRIDE FAILED');
    }
}

main().catch(console.error);
