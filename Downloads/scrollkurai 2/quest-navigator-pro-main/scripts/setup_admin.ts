
import { createClient } from '@supabase/supabase-js';

// Using service role key for admin operations
const SUPABASE_URL = 'https://vfxvvovudyaofgdbkfua.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmeHZ2b3Z1ZHlhb2ZnZGJrZnVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzIzNzc0NSwiZXhwIjoyMDgyODEzNzQ1fQ.gcsL6ezXgphSzlMY47IgQI2glPqJD5prHdFhXRq05d0';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function setupAdminUser() {
    const EMAIL = 'balanperiyasamy21@gmail.com';
    const PASSWORD = 'bala@1234';

    console.log('🔧 Setting up Admin User...\n');

    // Step 1: Create user via Auth Admin API
    console.log('Step 1: Creating user...');
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: EMAIL,
        password: PASSWORD,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
            username: 'Admin'
        }
    });

    if (createError) {
        if (createError.message.includes('already been registered')) {
            console.log('⚠️ User already exists, fetching existing user...');
            // Get existing user
            const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
            const existingUser = users?.find(u => u.email === EMAIL);
            if (existingUser) {
                console.log('✅ Found existing user:', existingUser.id);
                await assignAdminRole(existingUser.id, EMAIL);
                return;
            }
        } else {
            console.error('❌ Failed to create user:', createError.message);
            return;
        }
    } else {
        console.log('✅ User created:', userData.user?.id);
        await assignAdminRole(userData.user!.id, EMAIL);
    }
}

async function assignAdminRole(userId: string, email: string) {
    console.log('\nStep 2: Creating profile...');

    // Check if profile exists
    const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

    if (!existingProfile) {
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert({
                id: userId,
                username: 'Admin',
                xp: 0,
                level: 1,
                streak: 0
            });

        if (profileError) {
            console.error('❌ Failed to create profile:', profileError.message);
        } else {
            console.log('✅ Profile created');
        }
    } else {
        console.log('✅ Profile already exists');
    }

    console.log('\nStep 3: Assigning admin role...');

    // Check if role already exists
    const { data: existingRole } = await supabaseAdmin
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .single();

    if (existingRole) {
        console.log('✅ Admin role already assigned');
    } else {
        const { error: roleError } = await supabaseAdmin
            .from('user_roles')
            .insert({
                user_id: userId,
                role: 'admin'
            });

        if (roleError) {
            console.error('❌ Failed to assign role:', roleError.message);
        } else {
            console.log('✅ Admin role assigned');
        }
    }

    console.log('\n🎉 Admin setup complete!');
    console.log(`Email: ${email}`);
    console.log('Password: bala@1234');
    console.log('\nYou can now login at http://localhost:8080/');
}

setupAdminUser();
