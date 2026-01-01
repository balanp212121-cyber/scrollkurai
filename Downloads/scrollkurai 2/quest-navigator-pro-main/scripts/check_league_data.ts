import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

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
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || envConfig['SUPABASE_SERVICE_ROLE_KEY'];

const admin = createClient(SUPABASE_URL!, SERVICE_KEY!);

async function checkAndSeedLeagues() {
    console.log('=== League Data Check ===\n');

    // Check league_weeks
    const { data: weeks, error: wErr } = await admin.from('league_weeks').select('*').order('week_start', { ascending: false }).limit(3);
    console.log('league_weeks:', weeks?.length || 0, 'rows', wErr?.message || '');
    if (weeks) weeks.forEach(w => console.log('  -', w.week_start, 'processed:', w.processed));

    // Check league_participations
    const { data: parts, error: pErr } = await admin.from('league_participations').select('*').limit(5);
    console.log('\nleague_participations:', parts?.length || 0, 'rows', pErr?.message || '');

    // Check user_leagues
    const { data: userLeagues, error: uErr } = await admin.from('user_leagues').select('*').limit(5);
    console.log('user_leagues:', userLeagues?.length || 0, 'rows', uErr?.message || '');

    // If no data, seed it!
    if ((!parts || parts.length === 0) && (!userLeagues || userLeagues.length === 0)) {
        console.log('\n⚠️ No league data found. Seeding now...\n');

        // Get current week start (Monday)
        const today = new Date();
        const dayOfWeek = today.getDay();
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(today);
        monday.setDate(monday.getDate() + diffToMonday);
        monday.setHours(0, 0, 0, 0);

        const nextMonday = new Date(monday);
        nextMonday.setDate(nextMonday.getDate() + 7);

        // Create current week
        const { data: week, error: weekErr } = await admin
            .from('league_weeks')
            .upsert({
                week_start: monday.toISOString(),
                week_end: nextMonday.toISOString(),
                processed: false
            }, { onConflict: 'week_start' })
            .select()
            .single();

        if (weekErr) {
            console.log('Week creation error:', weekErr.message);
        } else {
            console.log('Created week:', week?.id);
        }

        // Get some users from profiles
        const { data: users } = await admin.from('profiles').select('id, username, xp').order('xp', { ascending: false }).limit(20);

        if (users && users.length > 0 && week) {
            console.log(`Found ${users.length} users to seed into leagues`);

            // Add users to user_leagues (bronze initially)
            for (const user of users) {
                await admin.from('user_leagues').upsert({
                    user_id: user.id,
                    league_tier: 'bronze'
                }, { onConflict: 'user_id' });

                // Also add to current week participation with XP based on their global XP
                await admin.from('league_participations').insert({
                    user_id: user.id,
                    week_id: week.id,
                    league_tier: 'bronze',
                    xp_earned: Math.floor(user.xp * 0.1), // 10% of global XP as seed
                    rank: 0
                }).then(({ error }) => {
                    if (error && !error.message.includes('duplicate')) {
                        console.log('Participation error:', error.message);
                    }
                });
            }

            console.log('✅ Seeded league data for', users.length, 'users');
        }
    }

    // Re-check
    const { data: finalParts } = await admin.from('league_participations').select('user_id, xp_earned, league_tier').order('xp_earned', { ascending: false }).limit(10);
    console.log('\nFinal league_participations (top 10):');
    finalParts?.forEach((p, i) => console.log(`  ${i + 1}. ${p.user_id.substring(0, 8)}... - ${p.xp_earned} XP (${p.league_tier})`));
}

checkAndSeedLeagues();
