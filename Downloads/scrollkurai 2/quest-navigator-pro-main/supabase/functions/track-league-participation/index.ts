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
    // Use user client for authentication
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Use service role client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Parse request body to get XP earned from quest
    const body = await req.json().catch(() => ({}));
    const xpEarned = body.xp_earned || 0;

    console.log('Tracking league participation for user:', user.id, 'XP earned:', xpEarned);

    // Get current week using admin client
    const { data: weekId, error: weekError } = await supabaseAdmin.rpc('get_current_league_week');
    if (weekError) {
      console.error('Error getting current week:', weekError);
      throw weekError;
    }

    console.log('Current week ID:', weekId);

    // Get user's current league
    const { data: userLeague, error: leagueError } = await supabaseAdmin
      .from('user_leagues')
      .select('league_tier')
      .eq('user_id', user.id)
      .maybeSingle();

    let currentTier = 'bronze';
    if (!userLeague) {
      // Create initial league membership
      const { error: insertError } = await supabaseAdmin
        .from('user_leagues')
        .insert({ user_id: user.id, league_tier: 'bronze' });
      
      if (insertError) {
        console.error('Error creating league membership:', insertError);
      }
    } else {
      currentTier = userLeague.league_tier;
    }

    // Check if participation record exists for this week
    const { data: existingParticipation, error: fetchError } = await supabaseAdmin
      .from('league_participations')
      .select('id, xp_earned')
      .eq('user_id', user.id)
      .eq('week_id', weekId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching existing participation:', fetchError);
      throw fetchError;
    }

    let participation;

    if (existingParticipation) {
      // Increment XP on existing record
      const newXpTotal = (existingParticipation.xp_earned || 0) + xpEarned;
      console.log('Updating existing participation. Previous XP:', existingParticipation.xp_earned, 'Adding:', xpEarned, 'New total:', newXpTotal);
      
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('league_participations')
        .update({ xp_earned: newXpTotal })
        .eq('id', existingParticipation.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating participation:', updateError);
        throw updateError;
      }
      participation = updated;
      console.log('Updated participation in DB:', participation);
    } else {
      // Create new participation record with initial XP
      console.log('Creating new participation with XP:', xpEarned);
      
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('league_participations')
        .insert({
          user_id: user.id,
          league_tier: currentTier,
          week_id: weekId,
          xp_earned: xpEarned,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting participation:', insertError);
        throw insertError;
      }
      participation = inserted;
      console.log('Inserted participation in DB:', participation);
    }

    console.log('Participation tracked successfully:', participation);

    return new Response(
      JSON.stringify({ 
        success: true, 
        participation,
        message: 'League participation tracked successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in track-league-participation:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
