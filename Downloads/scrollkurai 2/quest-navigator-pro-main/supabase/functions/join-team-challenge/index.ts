import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: {
                    headers: { Authorization: req.headers.get('Authorization')! },
                },
            }
        );

        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { team_id, challenge_id } = await req.json();

        if (!team_id || !challenge_id) {
            throw new Error('Team ID and Challenge ID are required');
        }

        console.log('User', user.id, 'attempting to join team', team_id, 'to challenge', challenge_id);

        // 1. Verify user is team creator or admin (optional, but good practice)
        // For now, we trust the RLS on the table to handle permissions, but we need
        // to fetch members to get their stats anyway.

        // Check if team exists and get creators
        const { data: team, error: teamError } = await supabaseClient
            .from('teams')
            .select('creator_id, name')
            .eq('id', team_id)
            .single();

        if (teamError || !team) throw new Error('Team not found');

        if (team.creator_id !== user.id) {
            throw new Error('Only the team creator can join challenges');
        }

        // 2. Check if already participating
        const { data: existingProgress } = await supabaseClient
            .from('team_challenge_progress')
            .select('id')
            .eq('team_id', team_id)
            .eq('challenge_id', challenge_id)
            .maybeSingle();

        if (existingProgress) {
            throw new Error('Team is already participating in this challenge');
        }

        // 3. Fetch all team members
        const { data: members, error: membersError } = await supabaseClient
            .from('team_members')
            .select('user_id')
            .eq('team_id', team_id);

        if (membersError || !members || members.length === 0) {
            throw new Error('Team has no members');
        }

        const memberIds = members.map(m => m.user_id);

        // 4. Fetch profiles for baseline stats
        const { data: profiles, error: profilesError } = await supabaseClient
            .from('profiles')
            .select('id, xp, total_quests_completed, streak')
            .in('id', memberIds);

        if (profilesError || !profiles) {
            throw new Error('Failed to fetch member profiles');
        }

        // 5. Construct baseline data
        const baselineData: Record<string, { xp: number; quests: number; streak: number }> = {};

        profiles.forEach(profile => {
            baselineData[profile.id] = {
                xp: profile.xp || 0,
                quests: profile.total_quests_completed || 0,
                streak: profile.streak || 0
            };
        });

        console.log('Baseline data constructed:', JSON.stringify(baselineData));

        // 6. Insert new participation record
        const { error: insertError } = await supabaseClient
            .from('team_challenge_progress')
            .insert({
                team_id,
                challenge_id,
                current_progress: 0,
                baseline_data: baselineData,
                joined_at: new Date().toISOString()
            });

        if (insertError) throw insertError;

        return new Response(
            JSON.stringify({
                success: true,
                message: `Team "${team.name}" joined the challenge successfully`,
                member_count: memberIds.length
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
    } catch (error) {
        console.error('Error in join-team-challenge:', error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
});
