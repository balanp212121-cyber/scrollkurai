
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

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
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || envConfig['SUPABASE_SERVICE_ROLE_KEY'];

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function verify() {
    const { data: bucket, error } = await supabase.storage.getBucket('payment-proofs');
    if (error) {
        console.error('Error fetching bucket:', error);
        process.exit(1);
    }

    console.log(`Bucket public: ${bucket.public}`);
    console.log(`Size Limit: ${bucket.file_size_limit}`);
    console.log(`Mime Types: ${JSON.stringify(bucket.allowed_mime_types)}`);

    const isSecure = bucket.file_size_limit === 1048576 &&
        bucket.public === false &&
        bucket.allowed_mime_types?.length === 3 &&
        !bucket.allowed_mime_types.includes('application/pdf');

    if (isSecure) {
        console.log('VERIFICATION: SECURE');
    } else {
        console.log('VERIFICATION: NOT SECURE');
        // Explicitly try update again if not secure?
        // Let's just report status.
    }
}

verify();
