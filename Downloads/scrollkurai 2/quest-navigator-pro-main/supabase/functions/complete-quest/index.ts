import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    const { log_id, reflection_text, is_golden_quest } = await req.json();

    const MAX_REFLECTION_LENGTH = 5000;

    if (!log_id || !reflection_text || reflection_text.length < 15) {
      return new Response(
        JSON.stringify({ error: 'Reflection must be at least 15 characters' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (reflection_text.length > MAX_REFLECTION_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Reflection must be less than ${MAX_REFLECTION_LENGTH} characters` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Completing quest for log_id:', log_id, 'Golden Quest:', is_golden_quest);

    // Verify the log belongs to the user and is not already completed
    const { data: questLog, error: logError } = await supabaseClient
      .from('user_quest_log')
      .select('*')
      .eq('id', log_id)
      .eq('user_id', user.id)
      .single();

    if (logError || !questLog) {
      console.error('Quest log error:', logError);
      return new Response(JSON.stringify({ error: 'Quest not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (questLog.completed_at) {
      return new Response(
        JSON.stringify({ error: 'Quest already completed' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get current profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile error:', profileError);
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const lastQuestDate = profile.last_quest_date;
    const now = new Date();

    // Check if streak freeze is active
    let streakFreezeActive = profile.streak_freeze_active;
    let streakFreezeExpiresAt = profile.streak_freeze_expires_at;

    // Auto-expire streak freeze if needed
    if (streakFreezeActive && streakFreezeExpiresAt) {
      const freezeExpires = new Date(streakFreezeExpiresAt);
      if (now >= freezeExpires) {
        streakFreezeActive = false;
        streakFreezeExpiresAt = null;
        console.log('Streak Freeze expired');
      }
    }

    // Calculate streak and track streak loss
    let newStreak = profile.streak;
    let streakLostAt = profile.streak_lost_at;
    let lastStreakCount = profile.last_streak_count;

    if (!lastQuestDate) {
      newStreak = 1;
      // Clear any existing streak loss tracking since this is first quest
      streakLostAt = null;
      lastStreakCount = null;
    } else {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (lastQuestDate === yesterdayStr) {
        newStreak += 1;
        // Clear streak loss tracking on successful streak continuation
        streakLostAt = null;
        lastStreakCount = null;
      } else if (lastQuestDate !== today) {
        // Check if streak freeze was protecting the streak
        if (streakFreezeActive) {
          // Streak freeze protects the streak - don't reset
          console.log('Streak Freeze protected streak from resetting!', {
            currentStreak: profile.streak,
            lastQuestDate,
            today,
          });
          // Streak continues from where it was
          newStreak = profile.streak + 1;
          streakLostAt = null;
          lastStreakCount = null;
          // Consume the streak freeze (it's one-time use)
          streakFreezeActive = false;
          streakFreezeExpiresAt = null;
        } else {
          // Streak is broken - save the lost streak info before resetting
          if (profile.streak > 1) {
            streakLostAt = new Date().toISOString();
            lastStreakCount = profile.streak;
            console.log('Streak lost! Saving for potential recovery:', {
              previousStreak: profile.streak,
              streakLostAt,
            });
          }
          newStreak = 1;
        }
      }
    }

    const baseXP = 250;
    const streakBonus = Math.floor(newStreak * 10);
    let totalXP = baseXP + streakBonus;
    let xpBoosterApplied = false;

    // Check for active XP Booster (reuse 'now' from above)
    if (profile.xp_booster_active && profile.xp_booster_expires_at) {
      const expiresAt = new Date(profile.xp_booster_expires_at);
      if (now < expiresAt) {
        // XP Booster is active - apply 2x multiplier
        totalXP = totalXP * 2;
        xpBoosterApplied = true;
        console.log('XP Booster active! XP doubled to:', totalXP);
      } else {
        // Booster has expired - will be cleared in profile update
        console.log('XP Booster expired, not applying multiplier');
      }
    }

    // Apply 3x multiplier for golden quests (stacks with XP booster)
    if (is_golden_quest) {
      totalXP = totalXP * 3;
      console.log('Golden Quest bonus applied! XP tripled to:', totalXP);
    }

    const newTotalXP = profile.xp + totalXP;
    const newLevel = Math.floor(newTotalXP / 1000) + 1;

    // Prepare XP booster status for profile update
    let xpBoosterActive = profile.xp_booster_active;
    let xpBoosterStartedAt = profile.xp_booster_started_at;
    let xpBoosterExpiresAt = profile.xp_booster_expires_at;

    // Auto-expire the booster if it has passed
    if (profile.xp_booster_active && profile.xp_booster_expires_at) {
      const expiresAt = new Date(profile.xp_booster_expires_at);
      if (now >= expiresAt) {
        xpBoosterActive = false;
        xpBoosterStartedAt = null;
        xpBoosterExpiresAt = null;
        console.log('XP Booster expired, clearing booster status');
      }
    }

    console.log('Awarding XP:', {
      baseXP,
      streakBonus,
      xpBoosterApplied,
      isGoldenQuest: is_golden_quest,
      totalXP,
      newTotalXP,
      newLevel,
      newStreak,
    });

    // ... earlier code remains (profile update validation etc) ...

    // Update quest log (CRITICAL SYNC PATH)
    const { error: updateLogError } = await supabaseClient
      .from('user_quest_log')
      .update({
        completed_at: new Date().toISOString(),
        reflection_text,
        xp_awarded: totalXP, // We calculated this synchronously above
      })
      .eq('id', log_id);

    if (updateLogError) {
      console.error('Update log error:', updateLogError);
      throw updateLogError;
    }

    // Update profile (CRITICAL SYNC PATH - needed for UI consistency)
    const { error: updateProfileError } = await supabaseClient
      .from('profiles')
      .update({
        xp: newTotalXP,
        level: newLevel,
        streak: newStreak,
        last_quest_date: today,
        total_quests_completed: profile.total_quests_completed + 1,
        streak_lost_at: streakLostAt,
        last_streak_count: lastStreakCount,
        xp_booster_active: xpBoosterActive,
        xp_booster_started_at: xpBoosterStartedAt,
        xp_booster_expires_at: xpBoosterExpiresAt,
        streak_freeze_active: streakFreezeActive,
        streak_freeze_expires_at: streakFreezeExpiresAt,
      })
      .eq('id', user.id);

    if (updateProfileError) {
      console.error('Update profile error:', updateProfileError);
      // Note: In a true distributed system we might need saga rollback here if log succeeded but profile failed, 
      // but for MVP/V1 this is acceptable risk as it's rare.
      throw updateProfileError;
    }

    // --- BACKGROUND TASKS (ASYNC) ---
    // These run AFTER the response is sent to the user
    // 
    // TODO [SCALE 100k+]: Replace with proper message queue (BullMQ, SQS)
    // Current approach works well for <100k users but for viral scale:
    // 1. Move these tasks to a dedicated worker process
    // 2. Add retry logic with exponential backoff
    // 3. Add dead letter queue for failed tasks
    // 4. Consider using Supabase pg_boss for PostgreSQL-native queuing
    //
    const processBackgroundTasks = async () => {
      console.log('Starting background tasks for quest completion...');
      const authHeader = req.headers.get('Authorization')!;

      // LOGGING: Start tracking this event
      let eventId = null;
      try {
        const { data: eventData, error: eventError } = await supabaseClient
          .from('events')
          .insert({
            type: 'quest_completion_background',
            payload: { log_id, user_id: user.id },
            status: 'processing'
          })
          .select()
          .single();

        if (!eventError && eventData) {
          eventId = eventData.id;
        } else {
          console.warn('Failed to create event log:', eventError);
        }
      } catch (e) {
        console.warn('Event log creation exception:', e);
      }

      let hasErrors = false;
      const errorDetails: string[] = [];

      // 1. Update Challenge Progress
      try {
        const { error: challengeError } = await supabaseClient.functions.invoke(
          'update-challenge-progress',
          { headers: { Authorization: authHeader } }
        );
        if (challengeError) {
          console.error('BG: Challenge update failed:', challengeError);
          hasErrors = true;
          errorDetails.push(`Challenge: ${JSON.stringify(challengeError)}`);
        }
      } catch (e) {
        console.error('BG: Challenge update exception:', e);
        hasErrors = true;
        errorDetails.push(`Challenge Ex: ${e}`);
      }

      // 2. Track League Participation
      try {
        const { error: leagueError } = await supabaseClient.functions.invoke(
          'track-league-participation',
          {
            headers: { Authorization: authHeader },
            body: { xp_earned: totalXP },
          }
        );
        if (leagueError) {
          console.error('BG: League update failed:', leagueError);
          hasErrors = true;
          errorDetails.push(`League: ${JSON.stringify(leagueError)}`);
        }
      } catch (e) {
        console.error('BG: League update exception:', e);
        hasErrors = true;
        errorDetails.push(`League Ex: ${e}`);
      }

      // 3. Track Analytics
      try {
        const { error: analyticsError } = await supabaseClient.functions.invoke(
          'track-analytics',
          {
            headers: { Authorization: authHeader },
            body: {
              xp_earned: totalXP,
              quests_completed: 1,
              time_saved_minutes: 15,
            },
          }
        );
        if (analyticsError) {
          console.error('BG: Analytics failed:', analyticsError);
          // Analytics failure is non-critical, strictly speaking, but we log it
          errorDetails.push(`Analytics: ${JSON.stringify(analyticsError)}`);
        }
      } catch (e) {
        console.error('BG: Analytics exception:', e);
      }

      // 4. Referral Rewards (First Quest Only)
      if (profile.total_quests_completed === 0) {
        try {
          // Update referral status db directly if possible or invoke function (keeping original logic)
          const { error: referralUpdateError } = await supabaseClient
            .from('referrals')
            .update({
              status: 'day_1_completed',
              completed_at: new Date().toISOString()
            })
            .eq('referred_id', user.id)
            .eq('status', 'pending');

          if (!referralUpdateError) {
            await supabaseClient.functions.invoke('process-referral-reward', { headers: { Authorization: authHeader } });
          }
        } catch (e) { console.error('BG: Referral exception:', e); }
      }

      // LOGGING: Update event status
      if (eventId) {
        try {
          await supabaseClient
            .from('events')
            .update({
              status: hasErrors ? 'failed' : 'completed',
              processed_at: new Date().toISOString(),
              error_message: hasErrors ? errorDetails.join('; ') : null
            })
            .eq('id', eventId);
        } catch (e) {
          console.warn('Failed to update event log:', e);
        }
      }

      console.log('Background tasks completed.');
    };

    // Trigger background tasks without awaiting
    // @ts-ignore: Deno EdgeRuntime type definition
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(processBackgroundTasks());
    } else {
      // Fallback for local dev or environments without waitUntil
      console.warn('EdgeRuntime.waitUntil not found, running background tasks without strict guarantee');
      processBackgroundTasks();
    }

    // --- RARE AVATAR DROP ---
    // Roll for a rare avatar drop (server-side RNG, cooldown enforced)
    let avatarDrop = null;
    try {
      const { data: dropResult, error: dropError } = await supabaseClient
        .rpc('roll_avatar_drop', { p_user_id: user.id, p_trigger: 'quest' });

      if (!dropError && dropResult?.dropped) {
        avatarDrop = dropResult.avatar;
        console.log('🎉 RARE AVATAR DROP:', avatarDrop);
      }
    } catch (e) {
      console.error('Avatar drop roll error:', e);
      // Non-blocking - don't fail quest completion if drop fails
    }

    // Return SUCCESS immediately to the user
    return new Response(
      JSON.stringify({
        success: true,
        xp_awarded: totalXP,
        streak: newStreak,
        total_xp: newTotalXP,
        level: newLevel,
        xp_booster_applied: xpBoosterApplied,
        avatar_drop: avatarDrop, // Will be null or { id, name, preset_id, emoji, bg_color, rarity }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in complete-quest:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
