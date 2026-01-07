
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Manual .env parsing
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8').split('\n').reduce((acc, line) => {
        const [key, ...value] = line.split('=');
        if (key && value) acc[key.trim()] = value.join('=').trim();
        return acc;
    }, {} as Record<string, string>);

    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
} else {
    console.log('⚠️ .env file not found at:', envPath);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function makeBalanOnlyAdmin() {
    console.log('🔍 Searching for user "balan"...');

    // 1. Find the user 'balan'
    // Try username first
    let { data: balanUser, error } = await supabase
        .from('profiles')
        .select('id, username, email') // email might not be in profiles? check schema usually profiles has id, username
        .ilike('username', '%balan%') // Flexible match
        .limit(1)
        .maybeSingle();

    if (!balanUser) {
        console.log('⚠️ User with username "balan" not found. Checking emails in Auth...');
        // We can't search auth users by username easily without admin api listUsers filtering
        // Let's assume Profile exists for balan
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username')
            .ilike('username', '%balan%');

        if (profiles && profiles.length > 0) {
            balanUser = profiles[0];
            console.log(`✅ Found partial match: ${balanUser.username} (${balanUser.id})`);
        } else {
            console.error('❌ Could not find any user matching "balan". Listing all admins to help you decide:');
            const { data: admins } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
            console.log('Current Admin IDs:', admins?.map(a => a.user_id));
            return;
        }
    } else {
        console.log(`✅ Found user: ${balanUser.username} (${balanUser.id})`);
    }

    const balanId = balanUser.id;

    // 2. Remove ALL 'admin' roles that are NOT balanId
    console.log('🧹 Removing other admins...');

    const { error: deleteError, count } = await supabase
        .from('user_roles')
        .delete({ count: 'exact' })
        .eq('role', 'admin')
        .neq('user_id', balanId);

    if (deleteError) {
        console.error('Error removing admins:', deleteError);
    } else {
        console.log(`✅ Removed ${count} other admin assignment(s).`);
    }

    // 3. Ensure Balan IS admin (and strict check: only 1 entry)
    // First, clean up any Balan duplicates just in case
    const { error: cleanBalanError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', balanId)
        .eq('role', 'admin');

    // Now switch to insert
    const { error: insertError } = await supabase
        .from('user_roles')
        .insert({ user_id: balanId, role: 'admin' });

    if (insertError) {
        console.error('Error adding admin role to Balan:', insertError);
    } else {
        console.log(`✅ User "${balanUser.username}" is now the SUPER ADMIN.`);
    }

    console.log('🎉 Done. Only "balan" is admin.');
}

makeBalanOnlyAdmin();
