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

    // Service role client for awarding rewards
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    console.log('Updating challenge progress for user:', user.id);

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('total_quests_completed, xp, streak')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;

    const { data: participations, error: participationsError } = await supabaseClient
      .from('challenge_participants')
      .select('id, challenge_id, current_progress, completed, baseline_quests, baseline_xp, baseline_streak, challenges(title, target_type, target_value, ends_at, starts_at, reward_xp, reward_badge_id, badges:reward_badge_id(name, icon))')
      .eq('user_id', user.id)
      .eq('completed', false);

    if (participationsError) throw participationsError;

    let updatedCount = 0;
    const rewardsAwarded: { challenge_id: string; xp_awarded: number; badge_awarded: boolean; badge_name?: string; badge_icon?: string }[] = [];

    // Update individual challenge progress
    if (participations && participations.length > 0) {
      for (const participation of participations) {
        const challenge = participation.challenges as any;
        if (new Date(challenge.ends_at) < new Date()) continue;

        // Get baseline values (default to 0 if not set - for legacy participants)
        const baselineQuests = participation.baseline_quests || 0;
        const baselineXp = participation.baseline_xp || 0;
        const baselineStreak = participation.baseline_streak || 0;

        // Calculate progress SINCE joining the challenge (not total)
        let currentProgress = 0;
        switch (challenge.target_type) {
          case 'quests': 
            currentProgress = Math.max(0, profile.total_quests_completed - baselineQuests); 
            break;
          case 'xp': 
            currentProgress = Math.max(0, profile.xp - baselineXp); 
            break;
          case 'streak': 
            // For streak, we track the current streak value (not difference)
            // But only count streaks that started after joining
            currentProgress = profile.streak; 
            break;
          default: continue;
        }

        const isCompleted = currentProgress >= challenge.target_value;
        const wasCompleted = participation.completed;

        const { error: updateError } = await supabaseClient
          .from('challenge_participants')
          .update({ 
            current_progress: currentProgress, 
            completed: isCompleted 
          })
          .eq('id', participation.id);

        if (!updateError) updatedCount++;

        // Award rewards if just completed
        if (isCompleted && !wasCompleted) {
          console.log('Challenge completed! Awarding rewards for challenge:', participation.challenge_id);
          
          // Check if already rewarded
          const { data: existingReward } = await supabaseAdmin
            .from('challenge_rewards')
            .select('id')
            .eq('user_id', user.id)
            .eq('challenge_id', participation.challenge_id)
            .maybeSingle();

          if (!existingReward) {
            let xpAwarded = 0;
            let badgeAwarded = false;
            let badgeName: string | undefined;
            let badgeIcon: string | undefined;

            // Award XP
            if (challenge.reward_xp > 0) {
              await supabaseAdmin
                .from('profiles')
                .update({ xp: profile.xp + challenge.reward_xp })
                .eq('id', user.id);
              
              xpAwarded = challenge.reward_xp;
            }

            // Award badge
            if (challenge.reward_badge_id) {
              const { data: existingBadge } = await supabaseAdmin
                .from('user_badges')
                .select('id')
                .eq('user_id', user.id)
                .eq('badge_id', challenge.reward_badge_id)
                .maybeSingle();

              if (!existingBadge) {
                await supabaseAdmin
                  .from('user_badges')
                  .insert({
                    user_id: user.id,
                    badge_id: challenge.reward_badge_id
                  });
                
                badgeAwarded = true;
                badgeName = challenge.badges?.name;
                badgeIcon = challenge.badges?.icon;
              }
            }

            // Record the reward
            await supabaseAdmin
              .from('challenge_rewards')
              .insert({
                user_id: user.id,
                challenge_id: participation.challenge_id,
                xp_awarded: challenge.reward_xp || 0,
                badge_awarded: challenge.reward_badge_id
              });

            rewardsAwarded.push({
              challenge_id: participation.challenge_id,
              xp_awarded: xpAwarded,
              badge_awarded: badgeAwarded,
              badge_name: badgeName,
              badge_icon: badgeIcon,
            });
          }
        }
      }
    }

    // === TEAM CHALLENGE PROGRESS AGGREGATION ===
    const { data: teamMemberships } = await supabaseClient
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id);

    if (teamMemberships && teamMemberships.length > 0) {
      const teamIds = teamMemberships.map((tm: any) => tm.team_id);

      const { data: teamChallenges } = await supabaseClient
        .from('team_challenge_progress')
        .select('id, team_id, challenge_id, completed, baseline_data, team_challenges(target_type, target_value, reward_xp, reward_badge_id, starts_at)')
        .in('team_id', teamIds)
        .eq('completed', false);

      for (const tc of teamChallenges || []) {
        const challenge = (tc as any).team_challenges;
        const baselineData = (tc as any).baseline_data || {};
        
        const { data: members } = await supabaseClient
          .from('team_members')
          .select('user_id')
          .eq('team_id', (tc as any).team_id);

        if (!members) continue;

        const memberIds = members.map((m: any) => m.user_id);
        const { data: profiles } = await supabaseClient
          .from('profiles')
          .select('id, total_quests_completed, xp, streak')
          .in('id', memberIds);

        if (!profiles) continue;

        // Calculate team progress from baselines
        let teamProgress = 0;
        switch (challenge.target_type) {
          case 'quests': 
            teamProgress = profiles.reduce((s: number, p: any) => {
              const baseline = baselineData[p.id]?.quests || 0;
              return s + Math.max(0, p.total_quests_completed - baseline);
            }, 0); 
            break;
          case 'xp': 
            teamProgress = profiles.reduce((s: number, p: any) => {
              const baseline = baselineData[p.id]?.xp || 0;
              return s + Math.max(0, p.xp - baseline);
            }, 0); 
            break;
          case 'streak': 
            teamProgress = Math.max(...profiles.map((p: any) => p.streak)); 
            break;
        }

        const teamCompleted = teamProgress >= challenge.target_value;
        const wasCompleted = (tc as any).completed;

        const { error: teamErr } = await supabaseClient
          .from('team_challenge_progress')
          .update({
            current_progress: teamProgress,
            completed: teamCompleted,
            completed_at: teamCompleted ? new Date().toISOString() : null,
          })
          .eq('id', (tc as any).id);

        if (!teamErr) updatedCount++;

        // Award team rewards to all members if just completed
        if (teamCompleted && !wasCompleted) {
          let teamXpAwarded = 0;
          let teamBadgeAwarded = false;

          for (const memberId of memberIds) {
            if (challenge.reward_xp > 0) {
              const { data: memberProfile } = await supabaseAdmin
                .from('profiles')
                .select('xp')
                .eq('id', memberId)
                .single();

              if (memberProfile) {
                await supabaseAdmin
                  .from('profiles')
                  .update({ xp: memberProfile.xp + challenge.reward_xp })
                  .eq('id', memberId);

                if (memberId === user.id) {
                  teamXpAwarded = challenge.reward_xp;
                }
              }
            }

            if (challenge.reward_badge_id) {
              const { data: existingBadge } = await supabaseAdmin
                .from('user_badges')
                .select('id')
                .eq('user_id', memberId)
                .eq('badge_id', challenge.reward_badge_id)
                .maybeSingle();

              if (!existingBadge) {
                await supabaseAdmin
                  .from('user_badges')
                  .insert({
                    user_id: memberId,
                    badge_id: challenge.reward_badge_id
                  });

                if (memberId === user.id) {
                  teamBadgeAwarded = true;
                }
              }
            }
          }

          // Track team reward for current user
          if (teamXpAwarded > 0 || teamBadgeAwarded) {
            rewardsAwarded.push({
              challenge_id: (tc as any).challenge_id,
              xp_awarded: teamXpAwarded,
              badge_awarded: teamBadgeAwarded,
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Updated ${updatedCount} challenge(s)`, 
        updatedCount,
        rewards: rewardsAwarded
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});