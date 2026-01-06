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

        const { challenge_id, partner_id } = await req.json();

        if (!challenge_id || !partner_id) {
            throw new Error('Challenge ID and Partner ID are required');
        }

        if (user.id === partner_id) {
            throw new Error('You cannot select yourself as a partner');
        }

        console.log('User', user.id, 'attempting to join duo challenge', challenge_id, 'with partner', partner_id);

        // 1. Verify partner exists
        const { data: partner, error: partnerError } = await supabaseClient
            .from('profiles')
            .select('id, username')
            .eq('id', partner_id)
            .single();

        if (partnerError || !partner) {
            throw new Error('Partner not found');
        }

        // 2. RULE 1: Verify partner is a friend (accepted friendship)
        const { data: friendship, error: friendError } = await supabaseClient
            .from('friends')
            .select('id')
            .or(`and(user_id.eq.${user.id},friend_id.eq.${partner_id},status.eq.accepted),and(user_id.eq.${partner_id},friend_id.eq.${user.id},status.eq.accepted)`)
            .maybeSingle();

        if (friendError) {
            console.error('Friend check error:', friendError);
        }

        if (!friendship) {
            throw new Error('You can only create Duo Challenges with friends');
        }

        // 3. Check if either user is already participating
        const { data: existingParticipants } = await supabaseClient
            .from('challenge_participants')
            .select('user_id')
            .eq('challenge_id', challenge_id)
            .in('user_id', [user.id, partner_id]);

        if (existingParticipants && existingParticipants.length > 0) {
            const existingIds = existingParticipants.map(p => p.user_id);
            if (existingIds.includes(user.id)) {
                throw new Error('You have already joined this challenge');
            }
            if (existingIds.includes(partner_id)) {
                throw new Error(`Partner ${partner.username} has already joined this challenge`);
            }
        }

        // 3. Fetch profiles for baseline stats (User + Partner)
        const { data: profiles, error: profilesError } = await supabaseClient
            .from('profiles')
            .select('id, xp, total_quests_completed, streak')
            .in('id', [user.id, partner_id]);

        if (profilesError || !profiles) {
            throw new Error('Failed to fetch profiles for baseline stats');
        }

        const userProfile = profiles.find(p => p.id === user.id) || { xp: 0, total_quests_completed: 0, streak: 0 };
        const partnerProfile = profiles.find(p => p.id === partner_id) || { xp: 0, total_quests_completed: 0, streak: 0 };

        // 4. Insert TWO participant records securely
        const { error: insertError } = await supabaseClient
            .from('challenge_participants')
            .insert([
                {
                    challenge_id,
                    user_id: user.id,
                    duo_partner_id: partner_id,
                    baseline_quests: userProfile.total_quests_completed || 0,
                    baseline_xp: userProfile.xp || 0,
                    baseline_streak: userProfile.streak || 0,
                    current_progress: 0
                },
                {
                    challenge_id,
                    user_id: partner_id,
                    duo_partner_id: user.id,
                    baseline_quests: partnerProfile.total_quests_completed || 0,
                    baseline_xp: partnerProfile.xp || 0,
                    baseline_streak: partnerProfile.streak || 0,
                    current_progress: 0
                }
            ]);

        if (insertError) throw insertError;

        return new Response(
            JSON.stringify({
                success: true,
                message: `Successfully joined Duo Challenge with ${partner.username}!`,
                partner_username: partner.username
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
    } catch (error) {
        console.error('Error in join-duo-challenge:', error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
});
