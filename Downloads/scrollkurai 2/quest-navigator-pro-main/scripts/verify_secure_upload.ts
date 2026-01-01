
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load env vars manually
const envPath = path.resolve(process.cwd(), '.env');
const envConfig = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, 'utf-8').split('\n').reduce((acc, line) => {
        const [key, ...value] = line.split('=');
        if (key && value) {
            acc[key.trim()] = value.join('=').trim();
        }
        return acc;
    }, {} as Record<string, string>)
    : {};

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || envConfig['VITE_SUPABASE_URL'];
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || envConfig['VITE_SUPABASE_PUBLISHABLE_KEY'];
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || envConfig['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SUPABASE_KEY || !SERVICE_KEY) {
    console.error('Missing env vars. Please run with proper .env');
    console.error(`URL: ${!!SUPABASE_URL}, KEY: ${!!SUPABASE_KEY}, SERVICE: ${!!SERVICE_KEY}`);
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

async function createTestUser() {
    const email = `audit_upload_${Date.now()}@test.com`;
    // Check if user exists first to avoid error
    const { data: users } = await adminClient.auth.admin.listUsers();
    // Clean up old test users if needed or just creating new unique one

    const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password: 'password123',
        email_confirm: true
    });
    if (error) {
        console.error('Create User Error:', error);
        throw error;
    }
    return data.user;
}

async function login(email: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: 'password123'
    });
    if (error) {
        console.error('Login Error:', error);
        throw error;
    }
    return data.session;
}

async function testUpload(session: any, fileName: string, content: Buffer, mimeType: string, description: string) {
    console.log(`\n--- Testing: ${description} ---`);
    const blob = new Blob([new Uint8Array(content)], { type: mimeType });
    const formData = new FormData();
    formData.append('file', blob, fileName);

    const res = await fetch(`${SUPABASE_URL}/functions/v1/upload-payment-proof`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${session.access_token}`
        },
        body: formData
    });

    const text = await res.text();
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${text}`);
    return { status: res.status, body: text };
}

async function runTests() {
    try {
        console.log('Creating user...');
        const user = await createTestUser();
        const session = await login(user.email!);
        console.log('Logged in.');

        // 1. Valid PNG
        const validPng = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // Minimal header
        await testUpload(session, 'valid.png', validPng, 'image/png', 'Valid PNG Header');

        // 2. Fake JPG (EXE disguised)
        const fakeJpg = Buffer.from([0x4D, 0x5A, 0x90, 0x00]); // MZ header (EXE)
        await testUpload(session, 'malware.jpg', fakeJpg, 'image/jpeg', 'EXE renamed to JPG');

        // 3. Oversized File
        const bigFile = Buffer.alloc(1048576 + 10, 0); // 1MB + 10 bytes
        await testUpload(session, 'big.jpg', bigFile, 'image/jpeg', 'Oversized File');

        // 4. Invalid MIME
        const pdf = Buffer.from('%PDF-1.5');
        await testUpload(session, 'doc.pdf', pdf, 'application/pdf', 'PDF File');

    } catch (e) {
        console.error(e);
    }
}

runTests();
