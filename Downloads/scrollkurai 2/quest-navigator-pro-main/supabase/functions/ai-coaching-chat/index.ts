import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const FALLBACK_MESSAGE = "I'm here to support you on your digital wellness journey. Could you tell me more about what you'd like to work on today?";
const API_TIMEOUT_MS = 30000;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required', response: FALLBACK_MESSAGE }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', response: FALLBACK_MESSAGE }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify premium status
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('premium_status')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.premium_status) {
      return new Response(
        JSON.stringify({ error: 'Premium subscription required for AI coaching', response: FALLBACK_MESSAGE }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================
    // RATE LIMITING (STRICT DB-ENFORCED)
    // ========================================
    const nowIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD in IST

    // Call RPC to atomically increment and get count
    const { data: usageCount, error: usageError } = await supabaseClient
      .rpc('increment_ai_usage', { p_user_id: user.id, p_date: nowIST });

    if (usageError) {
      console.error('Usage tracking error:', usageError);
      // Fail open or closed? For strict cost control, fail CLOSED.
      return new Response(
        JSON.stringify({ error: 'System error during rate limit check.', response: "I'm having a little trouble counting today. Please try again." }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit: Max 2 per day
    if (usageCount > 2) {
      console.warn(`Daily AI limit exceeded for user ${user.id} on ${nowIST} (Count: ${usageCount})`);
      return new Response(
        JSON.stringify({
          error: 'Daily AI limit reached',
          response: "You've reached your daily limit of 2 AI coaching sessions. I'll be refreshed and ready to help you again tomorrow!"
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { messages, systemPrompt } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Messages array is required', response: FALLBACK_MESSAGE }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use direct Google Gemini API (gemini-2.0-flash-exp)
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY is not configured');
      return new Response(
        JSON.stringify({
          error: 'AI service not configured',
          response: "AI coach is temporarily unavailable. Please try again in a few minutes."
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare contents for Gemini API (Message history)
    const contents = [];
    const contextPrompt = systemPrompt || "You are a supportive AI wellness coach specializing in digital wellness, reducing screen time, and building better habits. \n\nGoal: Help the user break down their quests into smallest actionable steps. \n\nTone: Warm, empathetic, encouraging, concise (2-4 sentences).";

    for (const msg of messages as ChatMessage[]) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    }

    console.log('Calling Google Gemini API (gemini-2.0-flash-exp) for coaching chat...');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: contents,
          systemInstruction: {
            parts: [{ text: contextPrompt }]
          },
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 500,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ response: "I'm having trouble connecting to my brain right now. Please try again in a moment." }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      console.error('No response generated from Gemini');
      return new Response(
        JSON.stringify({ response: FALLBACK_MESSAGE }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ response: generatedText }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in ai-coaching-chat function:', error);
    return new Response(
      JSON.stringify({ response: "AI coach is temporarily unavailable. Please try again in a few minutes." }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
