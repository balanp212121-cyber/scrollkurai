import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const envConfig = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, 'utf-8').split('\n').reduce((acc, line) => {
        const [key, ...value] = line.split('=');
        if (key && value) acc[key.trim()] = value.join('=').trim();
        return acc;
    }, {} as Record<string, string>)
    : {};

const SUPABASE_URL = envConfig['VITE_SUPABASE_URL'];
const SERVICE_KEY = envConfig['SUPABASE_SERVICE_ROLE_KEY'];

const admin = createClient(SUPABASE_URL!, SERVICE_KEY!);

async function test() {
    const { data, error } = await admin.rpc('get_league_leaderboard', {
        league_tier_param: 'bronze'
    });

    console.log('=== League Leaderboard (bronze) ===');
    if (error) {
        console.log('Error:', error.message);
    } else if (data && data.length > 0) {
        data.slice(0, 10).forEach((e: any, i: number) => {
            console.log(`${i + 1}. ${e.username || 'Anonymous'} - ${e.xp_earned} XP`);
        });
        console.log('\n✅ League now has', data.length, 'users!');
    } else {
        console.log('No entries');
    }
}

test();
