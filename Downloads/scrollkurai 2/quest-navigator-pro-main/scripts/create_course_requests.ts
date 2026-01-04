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
    console.log('Creating course_requests table...');

    // Check if table exists by trying to query it
    const { error: checkError } = await admin.from('course_requests').select('id').limit(1);

    if (!checkError) {
        console.log('✅ Table course_requests already exists');
        return;
    }

    if (checkError.code === '42P01') {
        console.log('Table does not exist, creating...');
        console.log('⚠️ Please run the migration manually in Supabase Dashboard:');
        console.log('SQL Editor > New Query > Paste the SQL from:');
        console.log('supabase/migrations/20260104000001_course_requests.sql');
    } else {
        console.log('Check error:', checkError.message);
    }
}

main().catch(console.error);
