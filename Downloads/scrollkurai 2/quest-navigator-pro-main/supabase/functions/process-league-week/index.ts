import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeagueParticipation {
  id: string;
  user_id: string;
  league_tier: string;
  xp_earned: number;
  rank: number;
}

const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];

function getNextTier(currentTier: string, promote: boolean): string {
  const currentIndex = TIER_ORDER.indexOf(currentTier);
  if (promote && currentIndex < TIER_ORDER.length - 1) {
    return TIER_ORDER[currentIndex + 1];
  } else if (!promote && currentIndex > 0) {
    return TIER_ORDER[currentIndex - 1];
  }
  return currentTier;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    console.log('Starting weekly league processing...');

    // Get last week's data
    const lastMonday = new Date();
    lastMonday.setDate(lastMonday.getDate() - 7 - lastMonday.getDay() + 1);
    lastMonday.setHours(0, 0, 0, 0);

    const { data: lastWeek, error: weekError } = await supabaseClient
      .from('league_weeks')
      .select('*')
      .eq('week_start', lastMonday.toISOString())
      .eq('processed', false)
      .single();

    if (weekError || !lastWeek) {
      console.log('No unprocessed week found or already processed');
      return new Response(
        JSON.stringify({ message: 'No week to process' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log('Processing week:', lastWeek.id);

    // Get all participations for each tier
    const { data: allParticipations, error: participationsError } = await supabaseClient
      .from('league_participations')
      .select('*')
      .eq('week_id', lastWeek.id)
      .order('xp_earned', { ascending: false });

    if (participationsError) {
      console.error('Error fetching participations:', participationsError);
      throw participationsError;
    }

    console.log('Total participations:', allParticipations?.length || 0);

    // Group by tier
    const tierGroups: Record<string, LeagueParticipation[]> = {};
    for (const tier of TIER_ORDER) {
      tierGroups[tier] = [];
    }

    for (const p of allParticipations || []) {
      tierGroups[p.league_tier].push(p);
    }

    // Process each tier
    const promotions: Array<{ userId: string; fromTier: string; toTier: string }> = [];
    const demotions: Array<{ userId: string; fromTier: string; toTier: string }> = [];
    const badges: Array<{ userId: string; badgeId: string }> = [];

    // Get league badges
    const { data: leagueBadges, error: badgesError } = await supabaseClient
      .from('badges')
      .select('*')
      .eq('requirement_type', 'league_rank');

    if (badgesError) {
      console.error('Error fetching badges:', badgesError);
    }

    for (const tier of TIER_ORDER) {
      const participants = tierGroups[tier];
      console.log(`Processing ${tier} league: ${participants.length} participants`);

      participants.forEach((p, index) => {
        const rank = index + 1;

        // Update rank
        supabaseClient
          .from('league_participations')
          .update({ rank })
          .eq('id', p.id)
          .then(({ error }) => {
            if (error) console.error('Error updating rank:', error);
          });

        // Top 10: Promote and award badge
        if (rank <= 10) {
          const newTier = getNextTier(tier, true);
          if (newTier !== tier) {
            promotions.push({ userId: p.user_id, fromTier: tier, toTier: newTier });
          }

          // Award badge
          const badge = leagueBadges?.find(b =>
            b.name.toLowerCase().includes(tier.toLowerCase())
          );
          if (badge) {
            badges.push({ userId: p.user_id, badgeId: badge.id });
          }

          // Mark as promoted
          supabaseClient
            .from('league_participations')
            .update({ promoted: true, badge_awarded: badge?.id })
            .eq('id', p.id)
            .then(({ error }) => {
              if (error) console.error('Error marking promotion:', error);
            });
        }
        // Bottom 5: Demote
        else if (rank > participants.length - 5) {
          const newTier = getNextTier(tier, false);
          if (newTier !== tier) {
            demotions.push({ userId: p.user_id, fromTier: tier, toTier: newTier });
          }

          // Mark as demoted
          supabaseClient
            .from('league_participations')
            .update({ demoted: true })
            .eq('id', p.id)
            .then(({ error }) => {
              if (error) console.error('Error marking demotion:', error);
            });
        }
      });
    }

    console.log('Promotions:', promotions.length);
    console.log('Demotions:', demotions.length);
    console.log('Badges to award:', badges.length);

    // Apply promotions
    for (const promo of promotions) {
      const { error } = await supabaseClient
        .from('user_leagues')
        .update({ league_tier: promo.toTier })
        .eq('user_id', promo.userId);

      if (error) {
        console.error('Error promoting user:', promo.userId, error);
      }
    }

    // Apply demotions
    for (const demo of demotions) {
      const { error } = await supabaseClient
        .from('user_leagues')
        .update({ league_tier: demo.toTier })
        .eq('user_id', demo.userId);

      if (error) {
        console.error('Error demoting user:', demo.userId, error);
      }
    }

    // Award badges
    for (const badge of badges) {
      const { error } = await supabaseClient
        .from('user_badges')
        .insert({
          user_id: badge.userId,
          badge_id: badge.badgeId,
        });

      if (error && !error.message.includes('duplicate')) {
        console.error('Error awarding badge:', badge.userId, error);
      }
    }

    // Mark week as processed
    const { error: processError } = await supabaseClient
      .from('league_weeks')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('id', lastWeek.id);

    if (processError) {
      console.error('Error marking week as processed:', processError);
    }

    // Reset league XP for all users after processing (new week starts fresh)
    const { error: resetError } = await supabaseClient
      .from('league_participations')
      .update({ xp_earned: 0 })
      .eq('week_id', lastWeek.id);

    if (resetError) {
      console.error('Error resetting league XP:', resetError);
    } else {
      console.log('League XP reset to 0 for all participants');
    }

    console.log('Weekly league processing completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        week_id: lastWeek.id,
        stats: {
          promotions: promotions.length,
          demotions: demotions.length,
          badges_awarded: badges.length,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in process-league-week:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
