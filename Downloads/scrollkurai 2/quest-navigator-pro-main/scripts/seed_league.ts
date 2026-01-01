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

async function seedLeagueData() {
    console.log('=== Seeding League Data ===\n');

    // First, get or create current week using the RPC
    const { data: weekId, error: weekErr } = await admin.rpc('get_current_league_week');

    if (weekErr) {
        console.log('get_current_league_week error:', weekErr.message);

        // Manually create the week
        const today = new Date();
        const dayOfWeek = today.getDay();
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(today);
        monday.setDate(monday.getDate() + diffToMonday);
        monday.setHours(0, 0, 0, 0);

        const nextMonday = new Date(monday);
        nextMonday.setDate(nextMonday.getDate() + 7);

        const { data: newWeek, error: createErr } = await admin
            .from('league_weeks')
            .insert({
                week_start: monday.toISOString(),
                week_end: nextMonday.toISOString(),
                processed: false
            })
            .select()
            .single();

        if (createErr && !createErr.message.includes('duplicate')) {
            console.log('Failed to create week:', createErr.message);
            return;
        }

        console.log('Created week manually');
    } else {
        console.log('Current week ID:', weekId);
    }

    // Get the actual week ID again
    const { data: currentWeekId } = await admin.rpc('get_current_league_week');

    if (!currentWeekId) {
        console.log('Still no week ID, checking league_weeks table...');
        const { data: weeks } = await admin.from('league_weeks').select('id').order('week_start', { ascending: false }).limit(1);
        if (!weeks || weeks.length === 0) {
            console.log('No weeks found. Cannot seed.');
            return;
        }
        console.log('Using latest week:', weeks[0].id);
    }

    const targetWeekId = currentWeekId || (await admin.from('league_weeks').select('id').order('week_start', { ascending: false }).limit(1)).data?.[0]?.id;

    if (!targetWeekId) {
        console.log('No target week ID');
        return;
    }

    console.log('Target week ID:', targetWeekId);

    // Get users from profiles
    const { data: users } = await admin.from('profiles').select('id, username, xp').order('xp', { ascending: false }).limit(20);

    if (!users || users.length === 0) {
        console.log('No users found');
        return;
    }

    console.log(`Found ${users.length} users to seed`);

    // Clear existing participations for this week to avoid duplicates
    await admin.from('league_participations').delete().eq('week_id', targetWeekId);

    // Seed participations
    for (const user of users) {
        const xpEarned = Math.floor(user.xp * 0.1) || Math.floor(Math.random() * 500) + 50;

        const { error } = await admin.from('league_participations').insert({
            user_id: user.id,
            week_id: targetWeekId,
            league_tier: 'bronze',
            xp_earned: xpEarned,
            rank: 0
        });

        if (error) {
            console.log(`Error seeding ${user.username}:`, error.message);
        } else {
            console.log(`+ ${user.username || 'Anonymous'}: ${xpEarned} XP`);
        }
    }

    // Now test the leaderboard
    console.log('\n=== Testing Leaderboard ===');
    const { data: leaderboard, error: lbErr } = await admin.rpc('get_league_leaderboard', {
        league_tier_param: 'bronze'
    });

    if (lbErr) {
        console.log('Leaderboard error:', lbErr.message);
    } else if (leaderboard && leaderboard.length > 0) {
        console.log(`\nTop 10 (${leaderboard.length} total):`);
        leaderboard.slice(0, 10).forEach((e: any, i: number) => {
            console.log(`${i + 1}. ${e.username || 'Anonymous'} - ${e.xp_earned} XP`);
        });
        console.log('\n✅ League data seeded successfully!');
    } else {
        console.log('Still no leaderboard entries');
    }
}

seedLeagueData();
