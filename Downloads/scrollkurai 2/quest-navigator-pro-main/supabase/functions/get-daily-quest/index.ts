
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Auth Check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
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

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('Auth User Error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Parse User Date (Critical for Timezones)
    let requestDate = new Date().toISOString().split('T')[0];
    try {
      const body = await req.json();
      if (body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
        requestDate = body.date;
      }
    } catch (e) {
      // Body might be empty, ignore
    }

    console.log(`Fetching daily quest for User ${user.id} on Date ${requestDate}`);

    // 3. Deterministic Check: Do we have a quest for this DATE?
    const { data: existingLog, error: logError } = await supabaseClient
      .from('user_quest_log')
      .select('*, quests(*)')
      .eq('user_id', user.id)
      .eq('assignment_date', requestDate)
      .maybeSingle();

    if (logError) console.error('Log fetch error:', logError);

    if (existingLog) {
      console.log('Returning existing quest');
      return new Response(
        JSON.stringify({
          quest: existingLog.quests,
          log_id: existingLog.id,
          completed: !!existingLog.completed_at,
          status: existingLog.status || (existingLog.completed_at ? 'completed' : 'active'),
          accepted_at: existingLog.accepted_at,
          date: existingLog.assignment_date
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. No Quest Found -> GENERATE ONE (Auto-Heal)
    console.log('No quest found. Generating new quest...');

    // Get Profile for Archetype
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('archetype')
      .eq('id', user.id)
      .single();

    // Avoid repeats from last 30 days (NON-REPETITION LOGIC)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentLogs } = await supabaseClient
      .from('user_quest_log')
      .select('quest_id')
      .eq('user_id', user.id)
      .gte('assignment_date', thirtyDaysAgo.toISOString().split('T')[0]);

    const ignoreIds = recentLogs?.map(l => l.quest_id) || [];

    // Select Quest - MUST filter by is_active = true
    let query = supabaseClient
      .from('quests')
      .select('id, content, target_archetype, reflection_prompt')
      .eq('is_active', true);  // Only active quests

    // Exclude quests used in last 30 days
    if (ignoreIds.length > 0) {
      query = query.not('id', 'in', `(${ignoreIds.join(',')})`);
    }

    // Prefer archetype or general
    if (profile?.archetype) {
      query = query.or(`target_archetype.eq.${profile.archetype},target_archetype.is.null`);
    }

    const { data: candidates } = await query.limit(20);

    let selectedQuest;
    if (candidates && candidates.length > 0) {
      // Randomly select from candidates
      selectedQuest = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
      // EXHAUSTION FALLBACK: All quests used in last 30 days
      console.warn('Quest exhaustion detected (30 days). Expanding to 60 days...');

      // Try 60 days window
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const { data: recentLogs60 } = await supabaseClient
        .from('user_quest_log')
        .select('quest_id')
        .eq('user_id', user.id)
        .gte('assignment_date', sixtyDaysAgo.toISOString().split('T')[0]);

      const ignoreIds60 = recentLogs60?.map(l => l.quest_id) || [];

      let fallbackQuery = supabaseClient
        .from('quests')
        .select('id, content, target_archetype, reflection_prompt')
        .eq('is_active', true);

      if (ignoreIds60.length > 0 && ignoreIds60.length < 100) {
        fallbackQuery = fallbackQuery.not('id', 'in', `(${ignoreIds60.join(',')})`);
      }

      const { data: fallbackCandidates } = await fallbackQuery.limit(10);

      if (fallbackCandidates && fallbackCandidates.length > 0) {
        selectedQuest = fallbackCandidates[Math.floor(Math.random() * fallbackCandidates.length)];
      } else {
        // Ultimate fallback: get any active quest (pool is too small)
        console.warn('CRITICAL: Quest pool exhausted. Using any active quest.');
        const { data: anyQuest } = await supabaseClient
          .from('quests')
          .select('id, content, reflection_prompt')
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        selectedQuest = anyQuest;
      }
    }

    if (!selectedQuest) {
      // ULTIMATE FALLBACK: Use user's most recently completed quest as a fallback
      console.warn('CRITICAL: No active quests available. Trying user last quest fallback.');

      const { data: lastUserQuest } = await supabaseClient
        .from('user_quest_log')
        .select('quest_id, quests(*)')
        .eq('user_id', user.id)
        .not('quests', 'is', null)
        .order('assignment_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastUserQuest?.quests) {
        selectedQuest = lastUserQuest.quests;
        console.log('Using last assigned quest as fallback:', selectedQuest.id);
      } else {
        // Absolute last resort: get ANY quest from the database
        const { data: absoluteFallback } = await supabaseClient
          .from('quests')
          .select('id, content, reflection_prompt')
          .limit(1)
          .maybeSingle();

        if (absoluteFallback) {
          selectedQuest = absoluteFallback;
          console.log('Using absolute fallback quest:', selectedQuest.id);
        }
      }
    }

    if (!selectedQuest) {
      console.error('CRITICAL: No quests available in entire database');
      return new Response(
        JSON.stringify({ error: 'No quests available. Please contact support.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Safe Assign (UPSERT to prevent race conditions)
    // Quests are assigned in 'pending' status - user must call accept-quest to activate
    const { data: newLog, error: upsertError } = await supabaseClient
      .from('user_quest_log')
      .upsert({
        user_id: user.id,
        quest_id: selectedQuest.id,
        assignment_date: requestDate,
        status: 'pending',
        accepted_at: null
      }, {
        onConflict: 'user_id, assignment_date',
        ignoreDuplicates: true
      })
      .select('*, quests(*)')
      .single();

    // If we ignored duplicate (race condition), fetch the winner
    let finalLog = newLog;
    if (!finalLog) {
      const { data: winner } = await supabaseClient
        .from('user_quest_log')
        .select('*, quests(*)')
        .eq('user_id', user.id)
        .eq('assignment_date', requestDate)
        .maybeSingle();
      finalLog = winner;
    }

    if (!finalLog) {
      console.error('Final Log Fetch Failed after upsert');
      throw new Error('Failed to retrieve quest log');
    }

    return new Response(
      JSON.stringify({
        quest: finalLog.quests || selectedQuest,
        log_id: finalLog.id,
        completed: !!finalLog.completed_at,
        status: finalLog.status || 'pending',
        accepted_at: finalLog.accepted_at,
        date: finalLog.assignment_date
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-daily-quest:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
