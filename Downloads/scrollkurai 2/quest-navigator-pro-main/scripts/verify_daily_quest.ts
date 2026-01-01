
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// --- Configuration & Setup ---
const LOG_FILE = 'daily_quest_fix_log.txt';

function log(message: string, type: 'INFO' | 'PASS' | 'FAIL' | 'WARN' = 'INFO') {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${type}] ${message}`;
    console.log(logLine);
    fs.appendFileSync(LOG_FILE, logLine + '\n');
}

// Load env vars manually - Permissive Parser
const envPath = path.resolve('c:\\Users\\Ragu\\Downloads\\scrollkurai 2\\quest-navigator-pro-main', '.env');
log(`Reading .env from: ${envPath}`);

const envConfig: Record<string, string> = {};
if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            // Join rest in case value has =
            const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
            envConfig[key] = val;
        }
    });
}

// Debug Keys (Redacted)
Object.keys(envConfig).forEach(k => {
    if (k.includes('KEY') || k.includes('URL')) {
        log(`Found Env Key: ${k}`);
    }
});

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || envConfig['VITE_SUPABASE_URL'];
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || envConfig['VITE_SUPABASE_PUBLISHABLE_KEY'];
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || envConfig['SUPABASE_SERVICE_ROLE_KEY'];

// --- Helper Functions ---
async function createTestUser(adminClient: SupabaseClient, email: string) {
    // Try to find existing first
    const { data: users } = await adminClient.auth.admin.listUsers();
    const existing = users?.users.find(u => u.email === email);
    if (existing) {
        await adminClient.from('user_quest_log').delete().eq('user_id', existing.id);
        return existing;
    }

    const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password: 'password123',
        email_confirm: true
    });

    if (error || !data.user) throw new Error(`Failed to create test user ${email}: ${error?.message}`);
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

// --- Verification Logic ---
async function verifyDailyQuestFix() {
    log('--- STARTING DAILY QUEST FIX VERIFICATION ---');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        log('Missing Credentials - Aborting', 'FAIL');
        return;
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    try {
        // 1. Setup User
        const user = await createTestUser(adminClient, 'daily_quest_tester@test.com');
        const { client } = await loginUser('daily_quest_tester@test.com');
        log('Test User Ready', 'PASS');

        // 2. Test Auto-Heal (No quest exists -> Create one)
        const today = new Date().toISOString().split('T')[0];
        log(`Requesting Quest for Date: ${today}`);

        const { data: response1, error: error1 } = await client.functions.invoke('get-daily-quest', {
            body: { date: today }
        });

        if (error1) {
            log(`First Request Failed: ${error1.message}`, 'FAIL');
            return;
        }

        log(`Received Response 1: QuestID=${response1?.quest?.id}, Date=${response1?.date}`);

        if (response1.quest && response1.date === today && response1.log_id) {
            log('Auto-Heal Success: Quest Generated', 'PASS');
        } else {
            log(`Auto-Heal Failed: Response invalid - ${JSON.stringify(response1)}`, 'FAIL');
        }

        const firstLogId = response1.log_id;

        // 3. Test Idempotency (Request again -> Same quest)
        log('Requesting Quest Again (Idempotency Check)...');
        const { data: response2, error: error2 } = await client.functions.invoke('get-daily-quest', {
            body: { date: today }
        });

        if (error2) {
            log(`Second Request Failed: ${error2.message}`, 'FAIL');
            return;
        }

        if (response2.log_id === firstLogId) {
            log('Idempotency Verified: Same Log ID returned', 'PASS');
        } else {
            log(`Idempotency FAILED: Different Log ID returned (${response2.log_id} vs ${firstLogId})`, 'FAIL');
        }

        // 4. Test Timezone Safety (Request for "Tomorrow" -> New quest)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        log(`Requesting Quest for Tomorrow: ${tomorrowStr}`);
        const { data: response3, error: error3 } = await client.functions.invoke('get-daily-quest', {
            body: { date: tomorrowStr }
        });

        if (response3.log_id !== firstLogId && response3.date === tomorrowStr) {
            log('Timezone/Date Logic Verified: Different quest for different date', 'PASS');
        } else {
            log(`Timezone Logic FAILED: ${JSON.stringify(response3)}`, 'FAIL');
        }

    } catch (e: any) {
        log(`Verification Exception: ${e.message}`, 'FAIL');
    }
}

verifyDailyQuestFix();
