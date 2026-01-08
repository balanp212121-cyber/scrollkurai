import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// === VALIDATION CONSTANTS (MUST MATCH FRONTEND) ===
const MIN_REFLECTION_LENGTH = 15;
const MAX_REFLECTION_LENGTH = 500;

/**
 * COMPLETE QUEST EDGE FUNCTION (HARDENED)
 * 
 * This function completes an active quest atomically.
 * It is 100% backend-authoritative, atomic, and idempotent.
 * 
 * Guarantees:
 * - XP awarded exactly once (no double completion)
 * - Duplicate calls return SUCCESS (idempotent)
 * - Quest must be in 'active' status (enforced by RPC)
 * - All state changes happen in a single transaction
 * - Domain events are logged for audit trail
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let userId: string | null = null;
  let logId: string | null = null;

  try {
    // === 1. VALIDATE AUTH ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[complete-quest] No authorization header');
      return new Response(
        JSON.stringify({
          error: 'Authorization required',
          error_code: 'AUTH_REQUIRED'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('[complete-quest] Auth error:', userError);
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          error_code: 'UNAUTHORIZED'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    userId = user.id;

    // === 2. VALIDATE INPUTS ===
    const { log_id, reflection_text, is_golden_quest } = await req.json();
    logId = log_id;

    if (!log_id) {
      console.error('[complete-quest] Missing log_id');
      return new Response(
        JSON.stringify({
          error: 'Quest ID is required',
          error_code: 'INVALID_INPUT'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(log_id)) {
      console.error('[complete-quest] Invalid UUID format:', log_id);
      return new Response(
        JSON.stringify({
          error: 'log_id must be a valid UUID',
          error_code: 'INVALID_UUID'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!reflection_text || typeof reflection_text !== 'string') {
      console.error('[complete-quest] Invalid reflection_text');
      return new Response(
        JSON.stringify({
          error: 'Reflection text is required',
          error_code: 'INVALID_INPUT'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmedReflection = reflection_text.trim();

    if (trimmedReflection.length < MIN_REFLECTION_LENGTH) {
      return new Response(
        JSON.stringify({
          error: `Reflection is too short (minimum ${MIN_REFLECTION_LENGTH} characters)`,
          error_code: 'VALIDATION_FAILED'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (trimmedReflection.length > MAX_REFLECTION_LENGTH) {
      return new Response(
        JSON.stringify({
          error: `Reflection is too long (maximum ${MAX_REFLECTION_LENGTH} characters)`,
          error_code: 'VALIDATION_FAILED'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === 3. ANTI-CHEAT: SPAM DETECTION ===
    const cleanedText = trimmedReflection.toLowerCase();
    const textNoSpaces = cleanedText.replace(/\s/g, '');

    // Check for repeated single character
    const charCounts: Record<string, number> = {};
    for (const char of textNoSpaces) {
      charCounts[char] = (charCounts[char] || 0) + 1;
    }
    const totalChars = textNoSpaces.length;
    const maxCharCount = Math.max(...Object.values(charCounts), 0);
    if (totalChars > 0 && maxCharCount / totalChars > 0.7) {
      console.warn(`[complete-quest] Spam detected (repeated chars): user=${userId}`);
      return new Response(
        JSON.stringify({
          error: 'Please write a meaningful reflection, not repeated characters',
          error_code: 'SPAM_DETECTED'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for repeated words
    const words = cleanedText.split(/\s+/).filter(w => w.length > 0);
    if (words.length >= 3) {
      const wordCounts: Record<string, number> = {};
      for (const word of words) {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      }
      const maxWordCount = Math.max(...Object.values(wordCounts), 0);
      if (maxWordCount / words.length > 0.7) {
        console.warn(`[complete-quest] Spam detected (repeated words): user=${userId}`);
        return new Response(
          JSON.stringify({
            error: 'Please write a genuine reflection, not repeated words',
            error_code: 'SPAM_DETECTED'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check for keyboard mashing patterns
    const spamPatterns = [
      /^(.)\1{10,}$/,
      /(asdf|qwer|zxcv|hjkl){2,}/i,
      /^(\w{1,3})\1{5,}$/,
    ];
    for (const pattern of spamPatterns) {
      if (pattern.test(textNoSpaces)) {
        console.warn(`[complete-quest] Spam detected (pattern): user=${userId}`);
        return new Response(
          JSON.stringify({
            error: 'Please write a thoughtful reflection about your experience',
            error_code: 'SPAM_DETECTED'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Require at least 3 unique words
    const uniqueWords = new Set(words.filter(w => w.length > 2));
    if (uniqueWords.size < 3) {
      return new Response(
        JSON.stringify({
          error: 'Please write a more detailed reflection with at least a few different words',
          error_code: 'VALIDATION_FAILED'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[complete-quest] Processing: user=${userId}, log_id=${log_id}, golden=${is_golden_quest}`);

    // === 4. CALL ATOMIC RPC ===
    const { data: result, error: rpcError } = await supabaseClient.rpc('complete_quest_atomic', {
      p_user_id: userId,
      p_log_id: log_id,
      p_reflection_text: trimmedReflection,
      p_is_golden_quest: is_golden_quest || false,
    });

    if (rpcError) {
      console.error('[complete-quest] RPC error:', rpcError);
      return new Response(
        JSON.stringify({
          error: 'Please try again — temporary issue',
          error_code: 'RPC_ERROR'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === 5. HANDLE RPC RESULT ===
    if (!result || !result.success) {
      const errorCode = result?.error_code || 'UNKNOWN';
      const errorMessage = result?.error || 'Quest completion failed';

      const statusMap: Record<string, number> = {
        'QUEST_NOT_FOUND': 404,
        'QUEST_NOT_ACTIVE': 400,
        'PROFILE_NOT_FOUND': 404,
        'INTERNAL_ERROR': 500,
      };

      // For idempotency - if already completed, RPC returns success with idempotent flag
      // This is handled above in success path

      let userMessage = errorMessage;
      if (errorCode === 'QUEST_NOT_ACTIVE') {
        userMessage = 'Please accept the quest before completing it.';
      }

      console.error(`[complete-quest] Failed: code=${errorCode}, msg=${errorMessage}`);
      return new Response(
        JSON.stringify({
          error: userMessage,
          error_code: errorCode
        }),
        { status: statusMap[errorCode] || 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === 6. BACKGROUND TASKS (NON-BLOCKING, FIRE-AND-FORGET) ===
    // These are secondary effects - the core completion is already DONE
    const processBackgroundTasks = async () => {
      console.log('[complete-quest] Starting background tasks...');

      try {
        await supabaseClient.functions.invoke('update-challenge-progress', {
          headers: { Authorization: authHeader },
        });
      } catch (e) {
        console.error('[complete-quest] BG: Challenge update failed:', e);
      }

      try {
        await supabaseClient.functions.invoke('track-league-participation', {
          headers: { Authorization: authHeader },
          body: { xp_earned: result.xp_awarded },
        });
      } catch (e) {
        console.error('[complete-quest] BG: League update failed:', e);
      }

      try {
        await supabaseClient.functions.invoke('track-analytics', {
          headers: { Authorization: authHeader },
          body: {
            xp_earned: result.xp_awarded,
            quests_completed: 1,
            time_saved_minutes: 15,
          },
        });
      } catch (e) {
        console.error('[complete-quest] BG: Analytics failed:', e);
      }

      console.log('[complete-quest] Background tasks completed.');
    };

    // Fire and forget - don't block the response
    // @ts-ignore: Deno EdgeRuntime
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(processBackgroundTasks());
    } else {
      processBackgroundTasks();
    }

    // === 7. RARE AVATAR DROP (NON-BLOCKING) ===
    let avatarDrop = null;
    try {
      const { data: dropResult, error: dropError } = await supabaseClient
        .rpc('roll_avatar_drop', { p_user_id: userId, p_trigger: 'quest' });

      if (!dropError && dropResult?.dropped) {
        avatarDrop = dropResult.avatar;
        console.log('[complete-quest] 🎉 RARE AVATAR DROP:', avatarDrop);
      }
    } catch (e) {
      console.error('[complete-quest] Avatar drop error:', e);
    }

    // === 8. RETURN SUCCESS ===
    const executionTime = Date.now() - startTime;
    console.log(`[complete-quest] SUCCESS: user=${userId}, log_id=${log_id}, xp=${result.xp_awarded}, idempotent=${result.idempotent || false}, time=${executionTime}ms`);

    const activePowerups = result.active_powerups || [];
    const hasXpBooster = activePowerups.some((n: string) => n === 'Blood Oath');

    return new Response(
      JSON.stringify({
        success: true,
        xp_awarded: result.xp_awarded,
        streak: result.streak,
        total_xp: result.new_total_xp, // Mapped from new RPC
        level: result.new_level,       // Mapped from new RPC
        xp_booster_applied: hasXpBooster,
        streak_freeze_used: false, // Not yet implemented in Canonical RPC
        avatar_drop: avatarDrop,
        idempotent: result.idempotent || false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`[complete-quest] EXCEPTION: user=${userId}, log_id=${logId}, time=${executionTime}ms, error=`, error);

    return new Response(
      JSON.stringify({
        error: 'Something went wrong, your streak is safe. Please try again.',
        error_code: 'INTERNAL_EXCEPTION'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
