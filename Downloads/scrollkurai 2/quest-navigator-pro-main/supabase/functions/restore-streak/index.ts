import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RECOVERY_WINDOW_HOURS = 24;

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

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('streak, streak_lost_at, last_streak_count')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user has a streak to recover
    if (!profile.streak_lost_at || !profile.last_streak_count) {
      return new Response(JSON.stringify({
        error: 'No streak to recover',
        reason: 'no_lost_streak'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if within 24-hour recovery window
    const streakLostAt = new Date(profile.streak_lost_at);
    const now = new Date();
    const hoursSinceLost = (now.getTime() - streakLostAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceLost > RECOVERY_WINDOW_HOURS) {
      return new Response(JSON.stringify({
        error: 'Streak Insurance expired',
        reason: 'window_expired',
        hours_expired: hoursSinceLost - RECOVERY_WINDOW_HOURS
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user has Streak Insurance power-up (streak_save effect type)
    // First try unused insurance, then check for active but not expired
    let streakInsurance = null;

    // Try to find unused insurance first (correct behavior)
    const { data: unusedInsurance, error: unusedError } = await supabaseClient
      .from('user_power_ups')
      .select('id, used_at, power_ups!inner(id, name, effect_type)')
      .eq('user_id', user.id)
      .is('used_at', null)
      .eq('power_ups.effect_type', 'streak_save')
      .limit(1)
      .maybeSingle();

    if (unusedError) {
      console.error('Error checking unused power-ups:', unusedError);
    }

    streakInsurance = unusedInsurance;

    // If no unused insurance, check for active but not yet consumed (legacy/incorrectly activated)
    if (!streakInsurance) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: activeInsurance, error: activeError } = await supabaseClient
        .from('user_power_ups')
        .select('id, used_at, power_ups!inner(id, name, effect_type)')
        .eq('user_id', user.id)
        .not('used_at', 'is', null)
        .gte('used_at', twentyFourHoursAgo)
        .eq('power_ups.effect_type', 'streak_save')
        .limit(1)
        .maybeSingle();

      if (activeError) {
        console.error('Error checking active power-ups:', activeError);
      }

      streakInsurance = activeInsurance;
    }

    if (!streakInsurance) {
      return new Response(JSON.stringify({
        error: 'No Streak Insurance available',
        reason: 'no_insurance'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Restore the streak
    const restoredStreak = profile.last_streak_count;
    const today = new Date().toISOString().split('T')[0];

    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({
        streak: restoredStreak,
        last_quest_date: today,
        streak_lost_at: null,
        last_streak_count: null,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error restoring streak:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to restore streak' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Consume the Streak Insurance power-up
    const { error: consumeError } = await supabaseClient
      .from('user_power_ups')
      .update({ used_at: new Date().toISOString() })
      .eq('id', streakInsurance.id);

    if (consumeError) {
      console.error('Error consuming power-up:', consumeError);
      // Don't fail the request, streak is already restored
    }

    console.log('Streak restored successfully:', {
      userId: user.id,
      restoredStreak,
      powerUpId: streakInsurance.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        restored_streak: restoredStreak,
        message: 'Streak restored successfully!',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in restore-streak:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
