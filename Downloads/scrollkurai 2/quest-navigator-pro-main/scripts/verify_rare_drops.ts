import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';

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

function log(msg: string, status: 'PASS' | 'FAIL' | 'INFO' = 'INFO') {
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : 'ℹ️';
    console.log(`${icon} ${msg}`);
}

async function run() {
    console.log('=== RARE AVATAR DROPS VERIFICATION ===\n');

    // 1. Verify tables exist
    console.log('--- Phase 1: Schema Verification ---');

    const { data: catalog, error: catalogError } = await adminClient
        .from('avatar_catalog')
        .select('*');

    if (catalogError) {
        log(`avatar_catalog table missing: ${catalogError.message}`, 'FAIL');
        return;
    }
    log(`avatar_catalog exists with ${catalog.length} avatars`, 'PASS');

    // 2. Check rare avatars are seeded
    const rareCount = catalog.filter(a => a.rarity === 'rare').length;
    const epicCount = catalog.filter(a => a.rarity === 'epic').length;
    const legendaryCount = catalog.filter(a => a.rarity === 'legendary').length;

    log(`Rare: ${rareCount}, Epic: ${epicCount}, Legendary: ${legendaryCount}`, 'INFO');
    if (rareCount >= 3 && epicCount >= 3 && legendaryCount >= 2) {
        log('All rarity tiers seeded', 'PASS');
    } else {
        log('Missing some rarity tiers', 'FAIL');
    }

    // 3. Test drop roll RPC
    console.log('\n--- Phase 2: Drop Roll Logic ---');

    // Get a test user
    const email = 'drop_test@test.com';
    const { data: users } = await adminClient.auth.admin.listUsers();
    let userId = users?.users.find(u => u.email === email)?.id;

    if (!userId) {
        const { data } = await adminClient.auth.admin.createUser({
            email, password: 'password123', email_confirm: true
        });
        userId = data.user?.id;
    }

    if (!userId) {
        log('Failed to get test user', 'FAIL');
        return;
    }
    log(`Test user: ${userId}`, 'INFO');

    // Clear any existing drops for test
    await adminClient.from('user_avatar_collection').delete().eq('user_id', userId);
    await adminClient.from('avatar_drop_cooldowns').delete().eq('user_id', userId);
    log('Cleared test user drops and cooldowns', 'INFO');

    // 4. Simulate multiple drop rolls
    let dropped = false;
    let dropCount = 0;
    const maxRolls = 100; // Roll up to 100 times to see if any drop

    for (let i = 0; i < maxRolls; i++) {
        const { data: result, error } = await adminClient.rpc('roll_avatar_drop', {
            p_user_id: userId,
            p_trigger: 'quest'
        });

        if (error) {
            log(`RPC error: ${error.message}`, 'FAIL');
            break;
        }

        if (result?.dropped) {
            dropped = true;
            dropCount++;
            log(`DROP! Got ${result.avatar?.name} (${result.avatar?.rarity}) on roll ${i + 1}`, 'PASS');
            break; // Cooldown will block further drops
        }
    }

    if (!dropped) {
        log(`No drops in ${maxRolls} rolls (expected with low rates)`, 'INFO');
    }

    // 5. Verify cooldown enforcement
    console.log('\n--- Phase 3: Cooldown Enforcement ---');

    const { data: cooldown } = await adminClient
        .from('avatar_drop_cooldowns')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (dropped && cooldown?.cooldown_until) {
        const cooldownDate = new Date(cooldown.cooldown_until);
        const now = new Date();
        const daysUntil = Math.ceil((cooldownDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        log(`Cooldown set: ${daysUntil} days remaining`, 'PASS');

        // Try to roll again - should fail due to cooldown
        const { data: blockedResult } = await adminClient.rpc('roll_avatar_drop', {
            p_user_id: userId,
            p_trigger: 'quest'
        });

        if (blockedResult?.dropped === false && blockedResult?.reason === 'cooldown') {
            log('Cooldown correctly blocks additional drops', 'PASS');
        } else {
            log('Cooldown may not be blocking correctly', 'FAIL');
        }
    } else if (dropped) {
        log('Drop occurred but no cooldown set', 'FAIL');
    } else {
        log('No drop occurred to test cooldown (OK)', 'INFO');
    }

    // 6. Verify collection uniqueness
    console.log('\n--- Phase 4: Collection Integrity ---');

    const { data: collection } = await adminClient
        .from('user_avatar_collection')
        .select('avatar_id')
        .eq('user_id', userId);

    if (collection) {
        const uniqueIds = new Set(collection.map(c => c.avatar_id));
        if (uniqueIds.size === collection.length) {
            log(`Collection has ${collection.length} unique avatars`, 'PASS');
        } else {
            log('Duplicate avatars in collection!', 'FAIL');
        }
    }

    console.log('\n=== RARE DROPS VERIFICATION COMPLETE ===');
}

run();
