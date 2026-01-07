import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

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

async function fixDuplicateRoles() {
    console.log('🔍 Checking for duplicate user roles...');

    // 1. Fetch all roles
    const { data: roles, error } = await supabase
        .from('user_roles')
        .select('id, user_id, role, created_at')
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching roles:', error);
        return;
    }

    if (!roles || roles.length === 0) {
        console.log('No roles found.');
        return;
    }

    console.log(`Found ${roles.length} total role assignments.`);

    // 2. Identify duplicates
    const seenStr = new Set<string>();
    const duplicatesToDelete: string[] = [];

    for (const r of roles) {
        const key = `${r.user_id}-${r.role}`;
        if (seenStr.has(key)) {
            // Duplicate!
            console.log(`❌ Found duplicate: User ${r.user_id} Role ${r.role} (ID: ${r.id})`);
            duplicatesToDelete.push(r.id);
        } else {
            seenStr.add(key);
        }
    }

    if (duplicatesToDelete.length === 0) {
        console.log('✅ No duplicates found.');
        return;
    }

    console.log(`⚠️ Found ${duplicatesToDelete.length} duplicates to remove.`);

    // 3. Delete duplicates
    const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .in('id', duplicatesToDelete);

    if (deleteError) {
        console.error('Error deleting duplicates:', deleteError);
    } else {
        console.log(`✅ Successfully removed ${duplicatesToDelete.length} duplicate roles.`);
        console.log('👉 Please apply the unique constraint migration to prevent recurrence.');
    }
}

fixDuplicateRoles();
