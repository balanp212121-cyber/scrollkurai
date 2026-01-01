
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
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || envConfig['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Missing env vars.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function lockBucket() {
    console.log('Locking down "payment-proofs" bucket...');

    const { data, error } = await supabase
        .storage
        .updateBucket('payment-proofs', {
            public: false,
            file_size_limit: 1048576, // 1MB
            allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp']
        });

    if (error) {
        console.error('Failed to lock bucket:', error);
        // Try creating if not exists? No, audit said it exists.
    } else {
        console.log('Bucket locked successfully!');
        console.log('Config:', data);
    }

    // Verify
    const { data: bucket, error: getError } = await supabase
        .storage
        .getBucket('payment-proofs');

    if (getError) {
        console.error('Verification failed:', getError);
    } else {
        console.log('Verification -- Current Config:');
        console.log(`- Public: ${bucket.public}`);
        console.log(`- Size Limit: ${bucket.file_size_limit} bytes`);
        console.log(`- MIME Types: ${bucket.allowed_mime_types}`);
    }
}

lockBucket();
