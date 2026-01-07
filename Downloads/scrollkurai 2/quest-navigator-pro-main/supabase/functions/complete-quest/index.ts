import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// === VALIDATION CONSTANTS (MUST MATCH FRONTEND) ===
const MIN_REFLECTION_LENGTH = 15;
const MAX_REFLECTION_LENGTH = 500;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
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

    // === VALIDATION (ALIGNED WITH FRONTEND) ===
    if (!log_id) {
      return new Response(
        JSON.stringify({ error: 'Quest ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!reflection_text || typeof reflection_text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Reflection text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmedReflection = reflection_text.trim();

    if (trimmedReflection.length < MIN_REFLECTION_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Reflection is too short (minimum ${MIN_REFLECTION_LENGTH} characters)` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (trimmedReflection.length > MAX_REFLECTION_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Reflection is too long (maximum ${MAX_REFLECTION_LENGTH} characters)` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === SPAM & ABUSE DETECTION (SOFT BUT CLEAR) ===
    const cleanedText = trimmedReflection.toLowerCase();

    // Check for repeated single character (e.g., "aaaaaaaaaa")
    const charCounts: Record<string, number> = {};
    const textNoSpaces = cleanedText.replace(/\s/g, '');
    for (const char of textNoSpaces) {
      charCounts[char] = (charCounts[char] || 0) + 1;
    }
    const totalChars = textNoSpaces.length;
    const maxCharCount = Math.max(...Object.values(charCounts), 0);
    if (totalChars > 0 && maxCharCount / totalChars > 0.7) {
      return new Response(
        JSON.stringify({ error: 'Please write a meaningful reflection, not repeated characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for repeated words (e.g., "test test test test")
    const words = cleanedText.split(/\s+/).filter(w => w.length > 0);
    if (words.length >= 3) {
      const wordCounts: Record<string, number> = {};
      for (const word of words) {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      }
      const maxWordCount = Math.max(...Object.values(wordCounts), 0);
      if (maxWordCount / words.length > 0.7) {
        return new Response(
          JSON.stringify({ error: 'Please write a genuine reflection, not repeated words' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check for keyboard mashing patterns
    const spamPatterns = [
      /^(.)\1{10,}$/,                    // Single char repeated 10+ times
      /(asdf|qwer|zxcv|hjkl){2,}/i,      // Keyboard row mashing
      /^(\w{1,3})\1{5,}$/,               // Short pattern repeated many times
    ];

    for (const pattern of spamPatterns) {
      if (pattern.test(textNoSpaces)) {
        return new Response(
          JSON.stringify({ error: 'Please write a thoughtful reflection about your experience' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Require at least 3 unique words
    const uniqueWords = new Set(words.filter(w => w.length > 2));
    if (uniqueWords.size < 3) {
      return new Response(
        JSON.stringify({ error: 'Please write a more detailed reflection with at least a few different words' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Completing quest for log_id:', log_id, 'Golden Quest:', is_golden_quest);

    // === CALL ATOMIC RPC FUNCTION ===
    const { data: result, error: rpcError } = await supabaseClient.rpc('complete_quest_atomic', {
      p_user_id: user.id,
      p_log_id: log_id,
      p_reflection_text: trimmedReflection,
      p_is_golden_quest: is_golden_quest || false,
    });

    if (rpcError) {
      console.error('RPC error:', rpcError);
      return new Response(
        JSON.stringify({ error: 'Please try again — temporary issue' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check RPC result
    if (!result || !result.success) {
      const errorMessage = result?.error || 'Quest completion failed';
      const errorCode = result?.error_code || 'UNKNOWN';

      // Map error codes to user-friendly messages
      let userMessage = errorMessage;
      let statusCode = 400;

      switch (errorCode) {
        case 'QUEST_NOT_FOUND':
          userMessage = 'Quest not found. Please refresh and try again.';
          statusCode = 404;
          break;
        case 'ALREADY_COMPLETED':
          userMessage = 'Quest already completed';
          statusCode = 400;
          break;
        case 'PROFILE_NOT_FOUND':
          userMessage = 'Profile not found. Please sign in again.';
          statusCode = 404;
          break;
        case 'INTERNAL_ERROR':
          userMessage = 'Something went wrong, your streak is safe. Please try again.';
          statusCode = 500;
          break;
      }

      return new Response(
        JSON.stringify({ error: userMessage, error_code: errorCode }),
        { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === BACKGROUND TASKS (NON-BLOCKING) ===
    const processBackgroundTasks = async () => {
      console.log('Starting background tasks for quest completion...');

      try {
        // 1. Update Challenge Progress
        await supabaseClient.functions.invoke('update-challenge-progress', {
          headers: { Authorization: authHeader },
        });
      } catch (e) {
        console.error('BG: Challenge update exception:', e);
      }

      try {
        // 2. Track League Participation
        await supabaseClient.functions.invoke('track-league-participation', {
          headers: { Authorization: authHeader },
          body: { xp_earned: result.xp_awarded },
        });
      } catch (e) {
        console.error('BG: League update exception:', e);
      }

      try {
        // 3. Track Analytics
        await supabaseClient.functions.invoke('track-analytics', {
          headers: { Authorization: authHeader },
          body: {
            xp_earned: result.xp_awarded,
            quests_completed: 1,
            time_saved_minutes: 15,
          },
        });
      } catch (e) {
        console.error('BG: Analytics exception:', e);
      }

      // 4. Referral Rewards (First Quest Only) - Check profile
      try {
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('total_quests_completed')
          .eq('id', user.id)
          .single();

        if (profile && profile.total_quests_completed === 1) {
          // This was their first quest
          const { error: referralUpdateError } = await supabaseClient
            .from('referrals')
            .update({
              status: 'day_1_completed',
              completed_at: new Date().toISOString()
            })
            .eq('referred_id', user.id)
            .eq('status', 'pending');

          if (!referralUpdateError) {
            await supabaseClient.functions.invoke('process-referral-reward', {
              headers: { Authorization: authHeader },
            });
          }
        }
      } catch (e) {
        console.error('BG: Referral exception:', e);
      }

      console.log('Background tasks completed.');
    };

    // Trigger background tasks without awaiting
    // @ts-ignore: Deno EdgeRuntime type definition
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(processBackgroundTasks());
    } else {
      processBackgroundTasks();
    }

    // === RARE AVATAR DROP ===
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
      // Non-blocking
    }

    // === RETURN SUCCESS ===
    return new Response(
      JSON.stringify({
        success: true,
        xp_awarded: result.xp_awarded,
        streak: result.streak,
        total_xp: result.total_xp,
        level: result.level,
        xp_booster_applied: result.xp_booster_applied,
        streak_freeze_used: result.streak_freeze_used,
        avatar_drop: avatarDrop,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in complete-quest:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Something went wrong, your streak is safe. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
