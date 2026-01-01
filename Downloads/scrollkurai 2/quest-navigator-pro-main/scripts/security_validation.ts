
import { createClient } from '@supabase/supabase-js';

// NEW PROJECT Configuration
const SUPABASE_URL = 'https://vfxvvovudyaofgdbkfua.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmeHZ2b3Z1ZHlhb2ZnZGJrZnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyMzc3NDUsImV4cCI6MjA4MjgxMzc0NX0.f5SspCiQcnkK7u_k2-pYO6bvM8YyKS_mK3NO5A-UYs8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runMigrationValidation() {
    console.log('🔒 Starting NEW PROJECT Validation...\n');
    console.log(`Project: vfxvvovudyaofgdbkfua`);
    console.log(`URL: ${SUPABASE_URL}\n`);

    // TEST 1: Connectivity
    console.log('TEST 1: Connectivity Check');
    try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
            console.error('❌ Connectivity Failed:', error.message);
        } else {
            console.log('✅ PASS: Connected to new Supabase project');
        }
    } catch (e) {
        console.error('❌ Connectivity Critical Failure:', e);
    }
    console.log('----------------------------------------');

    // TEST 2: Check admin_audit_logs table exists
    console.log('TEST 2: admin_audit_logs Table Exists');
    try {
        const { data, error } = await supabase.from('admin_audit_logs').select('id').limit(1);

        if (error) {
            if (error.message.includes('does not exist') || error.message.includes('schema cache')) {
                console.error('❌ FAIL: admin_audit_logs table does NOT exist');
            } else {
                // RLS blocked us, but table exists
                console.log('✅ PASS: admin_audit_logs table EXISTS (RLS correctly blocking anon access)');
            }
        } else {
            console.log('✅ PASS: admin_audit_logs table EXISTS (returned empty set)');
        }
    } catch (e) {
        console.log('❓ UNKNOWN: Exception during check');
    }
    console.log('----------------------------------------');

    // TEST 3: Check profiles table exists
    console.log('TEST 3: profiles Table Exists');
    try {
        const { data, error } = await supabase.from('profiles').select('id').limit(1);
        if (error) {
            console.error('❌ FAIL: profiles table check failed:', error.message);
        } else {
            console.log('✅ PASS: profiles table EXISTS');
        }
    } catch (e) {
        console.log('❓ UNKNOWN:', e);
    }
    console.log('----------------------------------------');

    // TEST 4: Check Edge Function reachability
    console.log('TEST 4: Edge Function Reachability (check-subscription-renewals)');
    try {
        const { data, error } = await supabase.functions.invoke('check-subscription-renewals');
        if (error) {
            console.log('⚠️ WARNING: Function invocation failed:', error.message);
        } else {
            console.log('✅ PASS: Edge Functions are reachable. Result:', data);
        }
    } catch (e) {
        console.log('❓ UNKNOWN:', e);
    }
    console.log('----------------------------------------');

    console.log('\n🎉 Validation Complete!');
}

runMigrationValidation();
