import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// FALLBACK QUESTS - Used when AI fails
// ============================================
const FALLBACK_QUESTS = [
  {
    title: "Focus Reset",
    description: "Spend 25 minutes on one meaningful task without distractions.",
    difficulty: "easy",
    estimatedTime: "25 min",
    xpReward: 50,
    reasoning: "A focused work block helps reset your productivity rhythm."
  },
  {
    title: "Digital Sunset",
    description: "Put your phone in another room for 1 hour before bed.",
    difficulty: "easy",
    estimatedTime: "60 min",
    xpReward: 75,
    reasoning: "Evening screen breaks improve sleep quality."
  },
  {
    title: "Mindful Check-In",
    description: "Take 5 minutes to write down how you're feeling right now.",
    difficulty: "easy",
    estimatedTime: "5 min",
    xpReward: 30,
    reasoning: "Self-awareness is the foundation of intentional living."
  }
];

const NO_GOALS_QUESTS = [
  {
    title: "Set Your First Goal",
    description: "Head to Goals and set one goal for the week. Start small!",
    difficulty: "easy",
    estimatedTime: "5 min",
    xpReward: 100,
    reasoning: "Goals give your journey direction and meaning."
  }
];

// Helper response creator
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
    console.log(`[GENERATE] ${msg}`);
    logs.push(`[${new Date().toISOString()}] ${msg}`);
  };

  try {
    log('=== QUEST GENERATION START ===');

    // ========================================
    // 1️⃣ AUTH - Use service role for DB operations
    // ========================================
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const authHeader = req.headers.get('Authorization');
    const supabaseClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader! } }
    });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      log('ERROR: Unauthorized');
      return createResponse({ error: 'Unauthorized' }, 401);
    }

    log(`User: ${user.id.substring(0, 8)}...`);

    // ========================================
    // 2️⃣ PROFILE & QUOTA CHECK
    // ========================================
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    const isPremium = profile?.premium_status === true;
    const currentMonth = new Date().toISOString().slice(0, 7);

    if (!isPremium) {
      const { data: monthlyUsage } = await supabaseAdmin
        .from('ai_goal_usage')
        .select('id')
        .eq('user_id', user.id)
        .eq('goal_month', currentMonth);

      if (monthlyUsage && monthlyUsage.length > 0) {
        log('Monthly limit reached');
        return createResponse({
          error: 'Monthly limit reached',
          code: 'MONTHLY_LIMIT',
          message: 'Free users get 1 AI quest generation per month. Upgrade to Premium!',
          nextAvailable: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()
        }, 403);
      }
    }

    // ========================================
    // 3️⃣ CHECK FOR GOALS
    // ========================================
    const { data: goals } = await supabaseAdmin
      .from('user_goals')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);

    // ========================================
    // 4️⃣ GENERATE QUESTS (AI or Fallback)
    // ========================================
    let recommendations = FALLBACK_QUESTS;
    let isFallback = false;

    if (!goals || goals.length === 0) {
      log('No goals - using goal-setting quests');
      recommendations = NO_GOALS_QUESTS;
      isFallback = true;
    } else {
      try {
        const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
        if (!LOVABLE_API_KEY) throw new Error('API key not configured');

        const goalContext = goals.map((g: any) =>
          `- ${g.goal_type}: Target ${g.target_value} min/day`
        ).join('\n');

        const systemPrompt = `Generate 3 personalized quests as JSON array.
USER: Level ${profile?.level || 1}, Streak ${profile?.streak || 0} days
GOALS:
${goalContext}

RESPOND WITH ONLY JSON (no markdown):
[{"title":"...","description":"...","difficulty":"easy|medium|hard","estimatedTime":"X min","xpReward":30-100,"reasoning":"..."}]`;

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: 'Generate my quests now. Return ONLY valid JSON.' }
            ],
            temperature: 0.7,
          }),
        });

        if (!aiResponse.ok) throw new Error(`AI API error: ${aiResponse.status}`);

        const aiData = await aiResponse.json();
        const content = aiData.choices[0]?.message?.content;

        if (content) {
          let jsonStr = content;
          const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (codeBlockMatch) jsonStr = codeBlockMatch[1];
          else {
            const arrayMatch = content.match(/\[[\s\S]*\]/);
            if (arrayMatch) jsonStr = arrayMatch[0];
          }
          jsonStr = jsonStr.replace(/^[^[{]*/, '').replace(/[^}\]]*$/, '').trim();
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            recommendations = parsed;
            log(`AI generated ${parsed.length} quests`);
          }
        }
      } catch (aiError) {
        log(`AI failed, using fallback: ${aiError}`);
        isFallback = true;
        recommendations = FALLBACK_QUESTS;
      }
    }

    // ========================================
    // 5️⃣ ATOMIC PERSISTENCE - CREATE QUESTS IN DB
    // ========================================
    log('Persisting quests to database...');

    const createdQuests: any[] = [];
    const createdAssignments: any[] = [];

    for (const rec of recommendations) {
      // Check if quest already exists by title
      const { data: existingQuest } = await supabaseAdmin
        .from('quests')
        .select('id')
        .eq('content', rec.title)
        .maybeSingle();

      let questId: string;

      if (existingQuest) {
        questId = existingQuest.id;
        log(`Quest exists: ${questId.substring(0, 8)}...`);
      } else {
        // Create new quest
        const { data: newQuest, error: createError } = await supabaseAdmin
          .from('quests')
          .insert({
            content: rec.title,
            reflection_prompt: `Reflect on completing "${rec.title}". ${rec.description}`,
            target_archetype: profile?.archetype || 'Mind Wanderer'
          })
          .select('id')
          .single();

        if (createError) {
          log(`ERROR creating quest: ${JSON.stringify(createError)}`);
          continue; // Skip this quest, try next
        }

        questId = newQuest.id;
        log(`Created quest: ${questId.substring(0, 8)}...`);
      }

      createdQuests.push({ ...rec, questId });

      // Check if user already has this quest assigned (not completed)
      const { data: existingAssignment } = await supabaseAdmin
        .from('user_quest_log')
        .select('id')
        .eq('user_id', user.id)
        .eq('quest_id', questId)
        .is('completed_at', null)
        .maybeSingle();

      if (!existingAssignment) {
        // Create assignment
        const { data: newAssignment, error: assignError } = await supabaseAdmin
          .from('user_quest_log')
          .insert({
            user_id: user.id,
            quest_id: questId,
            assigned_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (assignError) {
          log(`ERROR assigning quest: ${JSON.stringify(assignError)}`);
        } else {
          createdAssignments.push({ questId, logId: newAssignment.id });
          log(`Assigned: ${newAssignment.id.substring(0, 8)}...`);
        }
      } else {
        log(`Already assigned: ${existingAssignment.id.substring(0, 8)}...`);
        createdAssignments.push({ questId, logId: existingAssignment.id });
      }
    }

    // ========================================
    // 6️⃣ VERIFY AT LEAST ONE QUEST PERSISTED
    // ========================================
    if (createdQuests.length === 0) {
      log('ERROR: No quests could be created');
      return createResponse({
        success: false,
        error: 'Could not create quests. Please try again.',
        code: 'CREATION_FAILED'
      }, 500);
    }

    // ========================================
    // 7️⃣ TRACK USAGE (Non-Premium)
    // ========================================
    if (!isPremium) {
      await supabaseAdmin.from('ai_goal_usage').insert({
        user_id: user.id,
        goal_month: currentMonth,
        goal_content: JSON.stringify(createdQuests.map(q => q.title)),
        generated_at: new Date().toISOString()
      });
    }

    // ========================================
    // 8️⃣ LOG TO ADMIN
    // ========================================
    try {
      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_id: user.id,
        action_type: 'QUEST_GENERATION_SUCCESS',
        details: JSON.stringify({
          count: createdQuests.length,
          isFallback,
          questIds: createdQuests.map(q => q.questId)
        }),
        created_at: new Date().toISOString()
      });
    } catch (e) { }

    log(`=== SUCCESS: ${createdQuests.length} quests persisted ===`);

    // ========================================
    // 9️⃣ RETURN SUCCESS (ONLY AFTER DB COMMIT)
    // ========================================
    return createResponse({
      success: true,
      recommendations: createdQuests.map(q => ({
        ...q,
        id: q.questId // Include DB ID for frontend
      })),
      assignments: createdAssignments,
      userContext: {
        archetype: profile?.archetype || 'Beginner',
        level: profile?.level || 1,
        activeGoalsCount: goals?.length || 0,
        isPremium
      },
      isFallback,
      questsCreated: createdQuests.length,
      message: `${createdQuests.length} personalized quests ready!`
    });

  } catch (error) {
    console.error('CRITICAL ERROR:', error);

    return createResponse({
      success: false,
      error: 'We\'re preparing your quests. Please try again in a moment.',
      code: 'GENERATION_FAILED'
    }, 500);
  }
});