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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    );

    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const { xp_earned, quests_completed, time_saved_minutes } = await req.json();

    const today = new Date().toISOString().split('T')[0];

    // Get current profile for streak
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('streak')
      .eq('id', user.id)
      .single();

    // Upsert daily analytics
    const { data, error } = await supabaseClient
      .from('user_analytics_daily')
      .upsert({
        user_id: user.id,
        date: today,
        xp_earned: xp_earned || 0,
        quests_completed: quests_completed || 0,
        time_saved_minutes: time_saved_minutes || 0,
        streak: profile?.streak || 0,
      }, {
        onConflict: 'user_id,date',
      })
      .select()
      .single();

    if (error) {
      console.error('Error tracking analytics:', error);
      throw error;
    }

    // Check for milestones
    const milestones = [];
    
    if (profile?.streak && profile.streak % 7 === 0) {
      milestones.push({
        user_id: user.id,
        milestone_type: 'streak_week',
        milestone_value: profile.streak,
      });
    }

    if (xp_earned && xp_earned >= 1000) {
      milestones.push({
        user_id: user.id,
        milestone_type: 'xp_milestone',
        milestone_value: xp_earned,
      });
    }

    if (milestones.length > 0) {
      await supabaseClient.from('user_milestones').insert(milestones);
    }

    console.log('Analytics tracked successfully:', data);

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in track-analytics:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
