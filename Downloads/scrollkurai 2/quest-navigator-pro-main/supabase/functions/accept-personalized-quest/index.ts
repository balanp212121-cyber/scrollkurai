import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Extract user id from JWT (function is protected by verify_jwt)
    const token = authHeader.replace('Bearer', '').trim();
    let userId: string | null = null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      userId = payload?.sub ?? payload?.user_id ?? null;
    } catch (_) {}

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }


    const { questData } = await req.json();
    console.log('Accepting quest for user:', userId, questData);

    // Use service role to create quest
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if quest with same content already exists
    const { data: existingQuest } = await supabaseAdmin
      .from('quests')
      .select('id')
      .eq('content', questData.title)
      .maybeSingle();

    let questId: string;

    if (existingQuest) {
      // Quest already exists, check if user already has it
      const { data: existingAssignment } = await supabaseAdmin
        .from('user_quest_log')
        .select('id')
        .eq('user_id', userId)
        .eq('quest_id', existingQuest.id)
        .maybeSingle();

      if (existingAssignment) {
        // User already has this quest, return existing
        console.log('Quest already assigned to user:', existingQuest.id);
        return new Response(
          JSON.stringify({ success: true, questId: existingQuest.id, alreadyExists: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      questId = existingQuest.id;
    } else {
      // Create new quest
      const { data: newQuest, error: questError } = await supabaseAdmin
        .from('quests')
        .insert({
          content: questData.title,
          reflection_prompt: questData.reflectionPrompt,
          target_archetype: questData.archetype
        })
        .select()
        .single();

      if (questError) {
        console.error('Error creating quest:', questError);
        throw questError;
      }

      questId = newQuest.id;
    }

    // Assign quest to user
    const { error: logError } = await supabaseAdmin
      .from('user_quest_log')
      .insert({
        user_id: userId,
        quest_id: questId
      });

    if (logError) {
      console.error('Error assigning quest:', logError);
      throw logError;
    }

    console.log('Quest accepted successfully:', questId);

    return new Response(
      JSON.stringify({ success: true, questId: questId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in accept-personalized-quest:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
