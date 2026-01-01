import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { quest_log_id, reflection_text, quest_content } = await req.json();

    const MAX_REFLECTION_LENGTH = 5000;

    if (!quest_log_id || !reflection_text) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (reflection_text.length > MAX_REFLECTION_LENGTH) {
      return new Response(JSON.stringify({ error: `Reflection must be less than ${MAX_REFLECTION_LENGTH} characters` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Call Lovable AI for reflection analysis
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an empathetic AI coach helping users reflect on their personal growth journey. Analyze their reflection and provide:
1. A sentiment score (0-10, where 0 is negative and 10 is very positive)
2. Brief insights (2-3 sentences) about their reflection
3. A suggested next quest that builds on their progress

Be encouraging, specific, and actionable. Keep insights concise and motivating.`
          },
          {
            role: 'user',
            content: `Quest completed: "${quest_content || 'Daily quest'}"
            
User's reflection: "${reflection_text}"

Please analyze this reflection and provide insights.`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      throw new Error('AI gateway error');
    }

    const aiData = await response.json();
    const aiResponse = aiData.choices[0]?.message?.content || '';

    // Parse AI response to extract sentiment, insights, and suggestion
    // For simplicity, we'll store the entire response as insights
    // In production, you'd parse this more carefully
    const sentimentMatch = aiResponse.match(/sentiment.*?(\d+)/i);
    const sentiment = sentimentMatch ? parseInt(sentimentMatch[1]) : 5;

    // Store analysis in database
    const { error: insertError } = await supabaseClient
      .from('reflections_analysis')
      .insert({
        user_quest_log_id: quest_log_id,
        sentiment_score: sentiment,
        insights: aiResponse,
      });

    if (insertError) {
      console.error('Error storing analysis:', insertError);
    }

    return new Response(JSON.stringify({
      sentiment_score: sentiment,
      insights: aiResponse,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-reflection function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
