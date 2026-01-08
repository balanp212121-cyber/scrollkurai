import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to create consistent responses
const createResponse = (data: any, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logs.push(`[${new Date().toISOString()}] ${msg}`);
  };

  try {
    log('=== ACCEPT QUEST START ===');

    // ========================================
    // 1️⃣ AUTHENTICATION
    // ========================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      log('ERROR: No auth header');
      return createResponse({
        success: false,
        error: 'Please login to accept quests',
        code: 'AUTH_REQUIRED'
      }, 401);
    }

    // Extract user ID from JWT
    const token = authHeader.replace('Bearer', '').trim();
    let userId: string | null = null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      userId = payload?.sub ?? payload?.user_id ?? null;
      log(`Auth: user_id extracted: ${userId?.substring(0, 8)}...`);
    } catch (e) {
      log(`ERROR: JWT parse failed: ${e}`);
    }

    if (!userId) {
      return createResponse({
        success: false,
        error: 'Session expired. Please login again.',
        code: 'AUTH_INVALID'
      }, 401);
    }

    // ========================================
    // 2️⃣ PARSE REQUEST
    // ========================================
    let body;
    try {
      body = await req.json();
    } catch (e) {
      log(`ERROR: Failed to parse request body: ${e}`);
      return createResponse({
        success: false,
        error: 'Invalid request',
        code: 'INVALID_REQUEST'
      }, 400);
    }

    const { questData } = body;

    if (!questData || !questData.title) {
      log('ERROR: Missing questData or title');
      return createResponse({
        success: false,
        error: 'Quest data is required',
        code: 'INVALID_REQUEST'
      }, 400);
    }

    log(`Quest title: "${questData.title.substring(0, 50)}..."`);

    // ========================================
    // 3️⃣ CREATE SUPABASE ADMIN CLIENT
    // ========================================
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      log('ERROR: Missing Supabase credentials');
      return createResponse({
        success: false,
        error: 'Service configuration error',
        code: 'CONFIG_ERROR'
      }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    log('Supabase client created');

    // ========================================
    // 4️⃣ CHECK FOR EXISTING QUEST BY TITLE
    // ========================================
    const { data: existingQuest, error: findError } = await supabaseAdmin
      .from('quests')
      .select('id')
      .eq('content', questData.title)
      .maybeSingle();

    if (findError) {
      log(`ERROR: Quest lookup failed: ${JSON.stringify(findError)}`);
      return createResponse({
        success: false,
        error: 'Could not check quest. Please try again.',
        code: 'LOOKUP_FAILED',
        details: findError.message
      }, 500);
    }

    let questId: string;

    if (existingQuest) {
      questId = existingQuest.id;
      log(`Found existing quest: ${questId}`);

      // Check if user already has this quest ACTIVE
      const { data: existingAssignment, error: assignmentError } = await supabaseAdmin
        .from('user_quest_log')
        .select('id, completed_at')
        .eq('user_id', userId)
        .eq('quest_id', questId)
        .is('completed_at', null)
        .maybeSingle();

      if (assignmentError) {
        log(`ERROR: Assignment check failed: ${JSON.stringify(assignmentError)}`);
      }

      if (existingAssignment) {
        log(`Quest already active for user: ${existingAssignment.id}`);
        return createResponse({
          success: true,
          questId,
          logId: existingAssignment.id,
          alreadyActive: true,
          message: 'Quest is already in your active list!'
        });
      }
    } else {
      // ========================================
      // 5️⃣ CREATE NEW QUEST
      // ========================================
      log('Creating new quest...');

      const { data: newQuest, error: createError } = await supabaseAdmin
        .from('quests')
        .insert({
          content: questData.title,
          reflection_prompt: questData.reflectionPrompt || `Reflect on completing "${questData.title}". How did it help you?`,
          target_archetype: questData.archetype || 'Mind Wanderer'
        })
        .select('id')
        .single();

      if (createError) {
        log(`ERROR: Quest creation failed: ${JSON.stringify(createError)}`);
        return createResponse({
          success: false,
          error: 'Could not create quest. Please try again.',
          code: 'QUEST_CREATE_FAILED',
          details: createError.message
        }, 500);
      }

      questId = newQuest.id;
      log(`Created new quest: ${questId}`);
    }

    // ========================================
    // 6️⃣ ASSIGN QUEST TO USER
    // ========================================
    log(`Assigning quest ${questId} to user ${userId.substring(0, 8)}...`);

    const { data: newLog, error: logError } = await supabaseAdmin
      .from('user_quest_log')
      .insert({
        user_id: userId,
        quest_id: questId,
        assigned_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (logError) {
      log(`ERROR: Quest assignment failed: ${JSON.stringify(logError)}`);

      // Handle duplicate key constraint
      if (logError.code === '23505') {
        log('Duplicate detected - fetching existing assignment');

        const { data: existingLog } = await supabaseAdmin
          .from('user_quest_log')
          .select('id')
          .eq('user_id', userId)
          .eq('quest_id', questId)
          .is('completed_at', null)
          .maybeSingle();

        if (existingLog) {
          return createResponse({
            success: true,
            questId,
            logId: existingLog.id,
            alreadyActive: true,
            message: 'Quest is already in your active list!'
          });
        }
      }

      return createResponse({
        success: false,
        error: 'Could not accept quest. Please try again.',
        code: 'ASSIGN_FAILED',
        details: logError.message
      }, 500);
    }

    log(`SUCCESS: Quest assigned, log_id: ${newLog.id}`);

    // ========================================
    // 7️⃣ LOG TO ADMIN (optional)
    // ========================================
    try {
      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_id: userId,
        action_type: 'QUEST_ACCEPTED',
        details: JSON.stringify({
          questId,
          title: questData.title,
          logId: newLog.id,
          logs
        }),
        created_at: new Date().toISOString()
      });
    } catch (e) {
      log(`Admin log skipped: ${e}`);
    }

    // ========================================
    // 8️⃣ RETURN SUCCESS
    // ========================================
    log('=== ACCEPT QUEST END (SUCCESS) ===');

    return createResponse({
      success: true,
      questId,
      logId: newLog.id,
      message: 'Quest accepted! Go crush it! 💪'
    });

  } catch (error) {
    console.error('CRITICAL ERROR in accept-personalized-quest:', error);

    return createResponse({
      success: false,
      error: 'Something went wrong. Please try again.',
      code: 'UNKNOWN_ERROR',
      details: error instanceof Error ? error.message : 'Unknown'
    }, 500);
  }
});
