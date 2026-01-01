import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  userId: string;
  eventType: string;
  eventContext?: Record<string, any>;
  customMessage?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, eventType, eventContext, customMessage }: NotificationRequest = await req.json();

    console.log('Smart notification request:', { userId, eventType, eventContext });

    // Step 1: Check user notification preferences
    const { data: prefs, error: prefsError } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (prefsError) {
      console.error('Error fetching notification preferences:', prefsError);
    }

    // If user has notifications disabled for this type, skip
    const frequency = prefs?.notification_frequency || 'normal';
    if (frequency === 'minimal' && !['quest_complete', 'streak_milestone', 'theme_unlock'].includes(eventType)) {
      console.log('Notification skipped due to minimal frequency setting');
      return new Response(JSON.stringify({ sent: false, reason: 'minimal_frequency' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 2: Check rate limit (max 1 notification per 6 hours)
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: recentNotifications, error: historyError } = await supabase
      .from('notification_history')
      .select('id')
      .eq('user_id', userId)
      .gte('sent_at', sixHoursAgo)
      .limit(1);

    if (historyError) {
      console.error('Error checking notification history:', historyError);
    }

    if (recentNotifications && recentNotifications.length > 0) {
      console.log('Rate limit exceeded: notification sent within last 6 hours');
      return new Response(JSON.stringify({ sent: false, reason: 'rate_limit' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 3: Check for duplicate event (same event type within 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: duplicateCheck, error: dupError } = await supabase
      .from('notification_history')
      .select('id')
      .eq('user_id', userId)
      .eq('event_type', eventType)
      .gte('sent_at', twentyFourHoursAgo)
      .limit(1);

    if (dupError) {
      console.error('Error checking duplicates:', dupError);
    }

    if (duplicateCheck && duplicateCheck.length > 0) {
      console.log('Duplicate notification prevented for event:', eventType);
      return new Response(JSON.stringify({ sent: false, reason: 'duplicate' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 4: Get user profile for personalization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('username, streak, level, premium_status')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
    }

    // Step 5: Generate personalized notification message
    const message = customMessage || generatePersonalizedMessage(eventType, eventContext, profile);
    const title = generateTitle(eventType);

    // Step 6: Get push token
    const { data: tokenData, error: tokenError } = await supabase
      .from('push_notification_tokens')
      .select('push_token')
      .eq('user_id', userId)
      .maybeSingle();

    if (tokenError || !tokenData) {
      console.log('No push token found for user:', userId);
      // Still log the notification attempt
      await supabase.from('notification_history').insert({
        user_id: userId,
        event_type: eventType,
        event_context: eventContext,
      });
      return new Response(JSON.stringify({ sent: false, reason: 'no_token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 7: Send push notification via Capacitor Push API
    // For now, log it (actual push would require Capacitor Push Notifications plugin integration)
    console.log('Would send push notification:', {
      token: tokenData.push_token,
      title,
      message,
      eventType,
    });

    // Step 8: Log notification in history
    const { error: logError } = await supabase.from('notification_history').insert({
      user_id: userId,
      event_type: eventType,
      event_context: eventContext,
    });

    if (logError) {
      console.error('Error logging notification:', logError);
    }

    return new Response(JSON.stringify({ 
      sent: true, 
      message,
      title,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in send-smart-notification:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generatePersonalizedMessage(
  eventType: string,
  eventContext: Record<string, any> | undefined,
  profile: any
): string {
  const username = profile?.username || 'Warrior';
  const streak = profile?.streak || 0;
  const isPremium = profile?.premium_status || false;

  switch (eventType) {
    case 'quest_complete':
      return `🎯 Amazing work, ${username}! Quest completed. Keep the momentum going!`;
    
    case 'streak_milestone':
      const streakCount = eventContext?.streak || streak;
      if (streakCount >= 30) {
        return `🔥 LEGENDARY! ${streakCount}-day streak! You're unstoppable, ${username}!`;
      } else if (streakCount >= 7) {
        return `🔥 ${streakCount} days strong! Your streak is on fire, ${username}!`;
      }
      return `⭐ ${streakCount}-day streak maintained! You're building great habits!`;
    
    case 'theme_unlock':
      const themeName = eventContext?.theme_name || 'new theme';
      return `🎨 New theme unlocked: ${themeName}! ${isPremium ? 'Premium perks in action!' : 'Check it out!'}`;
    
    case 'return_after_gap':
      const daysGone = eventContext?.days_gone || 1;
      return `👋 Welcome back, ${username}! ${daysGone} ${daysGone === 1 ? 'day' : 'days'} since your last quest. Ready to dive back in?`;
    
    case 'assessment_complete':
      return `✅ Assessment complete! Your insights are ready, ${username}.`;
    
    case 'milestone_reached':
      const milestoneType = eventContext?.milestone_type || 'milestone';
      const milestoneValue = eventContext?.milestone_value || 0;
      return `🏆 Milestone reached: ${milestoneValue} ${milestoneType}! You're crushing it!`;
    
    case 'friend_ahead':
      const friendCount = eventContext?.friend_count || 1;
      return `🏃 ${friendCount} ${friendCount === 1 ? 'friend is' : 'friends are'} ahead today. Time to catch up!`;
    
    case 'time_saved':
      const hoursSaved = eventContext?.hours_saved || 0;
      return `⏰ You've saved ${hoursSaved} hours this week. That's like gaining a whole day back!`;
    
    case 'xp_booster_expiring':
      const xpMinutes = eventContext?.minutes_until_expiry || 60;
      const xpTimeText = xpMinutes >= 60 ? `${Math.round(xpMinutes / 60)} hour${Math.round(xpMinutes / 60) !== 1 ? 's' : ''}` : `${xpMinutes} minutes`;
      return `⚡ Your 2× XP Booster expires in ${xpTimeText}. Complete quests now to maximize your gains, ${username}!`;
    
    case 'streak_freeze_expiring':
      const freezeMinutes = eventContext?.minutes_until_expiry || 60;
      const freezeTimeText = freezeMinutes >= 60 ? `${Math.round(freezeMinutes / 60)} hour${Math.round(freezeMinutes / 60) !== 1 ? 's' : ''}` : `${freezeMinutes} minutes`;
      return `❄️ Your Streak Freeze expires in ${freezeTimeText}. Complete today's quest to keep your streak safe, ${username}!`;
    
    default:
      return `Hey ${username}! Something awesome happened in ScrollKurai!`;
  }
}

function generateTitle(eventType: string): string {
  switch (eventType) {
    case 'quest_complete':
      return 'Quest Complete! 🎯';
    case 'streak_milestone':
      return 'Streak Milestone! 🔥';
    case 'theme_unlock':
      return 'Theme Unlocked! 🎨';
    case 'return_after_gap':
      return 'Welcome Back! 👋';
    case 'assessment_complete':
      return 'Assessment Done! ✅';
    case 'milestone_reached':
      return 'Milestone Reached! 🏆';
    case 'friend_ahead':
      return 'Challenge Alert! 🏃';
    case 'time_saved':
      return 'Time Saved! ⏰';
    case 'xp_booster_expiring':
      return 'XP Booster Expiring! ⚡';
    case 'streak_freeze_expiring':
      return 'Streak Freeze Expiring! ❄️';
    default:
      return 'ScrollKurai Update';
  }
}
