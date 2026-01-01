import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch user profile and activity data
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Check monthly usage for non-premium users
    const isPremium = profile?.premium_status === true;
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

    if (!isPremium) {
      const { data: monthlyUsage } = await supabaseClient
        .from('ai_goal_usage')
        .select('id')
        .eq('user_id', user.id)
        .eq('goal_month', currentMonth);

      if (monthlyUsage && monthlyUsage.length > 0) {
        return new Response(
          JSON.stringify({ 
            error: 'Monthly limit reached',
            code: 'MONTHLY_LIMIT',
            message: 'Free users can generate AI quests once per month. Upgrade to Premium for unlimited access!',
            nextAvailable: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const { data: goals } = await supabaseClient
      .from('user_goals')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);

    // Get today's daily quest to exclude it
    const today = new Date().toISOString().split('T')[0];
    const { data: todayQuest } = await supabaseClient
      .from('user_quest_log')
      .select('*, quests(*)')
      .eq('user_id', user.id)
      .gte('assigned_at', `${today}T00:00:00`)
      .lte('assigned_at', `${today}T23:59:59`)
      .order('assigned_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get quests from the last 45 days to avoid repetition
    const fortyFiveDaysAgo = new Date();
    fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);

    const { data: recentQuests } = await supabaseClient
      .from('user_quest_log')
      .select('*, quests(*)')
      .eq('user_id', user.id)
      .gte('assigned_at', fortyFiveDaysAgo.toISOString())
      .order('assigned_at', { ascending: false });

    // Get quest completion patterns
    const { data: completionStats } = await supabaseClient
      .from('user_quest_log')
      .select('completed_at, assigned_at')
      .eq('user_id', user.id)
      .not('completed_at', 'is', null);

    const avgCompletionTime = completionStats?.length 
      ? completionStats.reduce((acc, q) => {
          const assigned = new Date(q.assigned_at).getTime();
          const completed = new Date(q.completed_at!).getTime();
          return acc + (completed - assigned);
        }, 0) / completionStats.length / (1000 * 60 * 60) // hours
      : 0;

    // Build context for AI
    const userContext = {
      archetype: profile?.archetype || 'Beginner',
      level: profile?.level || 1,
      xp: profile?.xp || 0,
      streak: profile?.streak || 0,
      totalQuestsCompleted: profile?.total_quests_completed || 0,
      activeGoals: goals || [],
      todayQuest: todayQuest?.quests?.content || null,
      recentQuestTypes: recentQuests?.map(q => q.quests?.content) || [],
      averageCompletionTimeHours: Math.round(avgCompletionTime * 10) / 10,
      engagementLevel: profile?.streak > 7 ? 'high' : profile?.streak > 3 ? 'medium' : 'low'
    };

    console.log('Generating personalized quests for user:', user.id, userContext);

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const systemPrompt = `You are an AI personalization engine for a digital wellness app that helps users reduce screen time and build better habits. 

Analyze the user's profile and generate 3-5 personalized quest recommendations that will help them achieve their goals.

User Profile:
- Archetype: ${userContext.archetype}
- Level: ${userContext.level}
- Current Streak: ${userContext.streak} days
- Total Quests Completed: ${userContext.totalQuestsCompleted}
- Engagement Level: ${userContext.engagementLevel}
- Average Quest Completion Time: ${userContext.averageCompletionTimeHours} hours

Active Goals:
${userContext.activeGoals.map((g: any) => 
  `- ${g.goal_type}: ${g.target_app ? `Reduce ${g.target_app} by` : 'Target'} ${g.target_value} minutes/day (Current: ${g.current_baseline || 'unknown'} min)`
).join('\n') || 'No active goals set'}

Today's Daily Quest (DO NOT RECOMMEND):
${userContext.todayQuest || 'None assigned today'}

Recent Quest Patterns (Last 45 Days):
${userContext.recentQuestTypes.slice(0, 10).join('\n') || 'No recent quests'}

CRITICAL: 
- DO NOT recommend today's daily quest listed above
- DO NOT recommend any quests similar to or repeating the recent quests
- The user should not see the same quest for at least 45 days
- Provide ONLY fresh, unique AI recommendations

Generate personalized recommendations that:
1. Align with their active goals
2. Match their engagement level and streak
3. Gradually increase in difficulty
4. Are specific and actionable
5. Include variety to prevent burnout
6. Are completely different from recent quests (no repeats for 45 days)

Return your recommendations as a JSON array with this structure. CRITICAL: Return ONLY the JSON array, no markdown code blocks, no extra text before or after:
[
  {
    "title": "Quest title (max 60 chars)",
    "description": "Detailed description (2-3 sentences)",
    "difficulty": "easy|medium|hard",
    "estimatedTime": "15-30 min",
    "xpReward": 100-500,
    "reasoning": "Why this quest fits the user (1 sentence)"
  }
]`;

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
          { role: 'user', content: 'Generate personalized quest recommendations for me. Return ONLY valid JSON array.' }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), 
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }), 
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
    
    // Parse AI response with robust error handling
    let recommendations;
    try {
      // Try multiple parsing strategies
      let jsonStr = content;
      
      // Strategy 1: Extract from markdown code blocks
      const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1];
      } 
      // Strategy 2: Extract array from text
      else {
        const arrayMatch = content.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          jsonStr = arrayMatch[0];
        }
      }
      
      // Clean up common issues
      jsonStr = jsonStr
        .replace(/^[^[{]*/, '') // Remove text before JSON
        .replace(/[^}\]]*$/, '') // Remove text after JSON
        .trim();
      
      recommendations = JSON.parse(jsonStr);
      
      // Validate structure
      if (!Array.isArray(recommendations) || recommendations.length === 0) {
        throw new Error('Invalid recommendations structure');
      }
      
      // Validate each recommendation has required fields
      for (const rec of recommendations) {
        if (!rec.title || !rec.description || !rec.difficulty || !rec.xpReward) {
          console.warn('Invalid recommendation structure:', rec);
          throw new Error('Missing required fields in recommendation');
        }
      }
      
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      console.error('Parse error:', parseError);
      throw new Error('Failed to parse AI recommendations. Please try again.');
    }

    console.log('Generated recommendations:', recommendations);

    // Track usage for non-premium users
    if (!isPremium) {
      await supabaseClient
        .from('ai_goal_usage')
        .insert({
          user_id: user.id,
          goal_month: currentMonth,
          goal_content: JSON.stringify(recommendations.map((r: any) => r.title)),
          generated_at: new Date().toISOString()
        });
    }

    return new Response(
      JSON.stringify({ 
        recommendations,
        userContext: {
          archetype: userContext.archetype,
          level: userContext.level,
          activeGoalsCount: userContext.activeGoals.length,
          isPremium
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-personalized-quests:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});