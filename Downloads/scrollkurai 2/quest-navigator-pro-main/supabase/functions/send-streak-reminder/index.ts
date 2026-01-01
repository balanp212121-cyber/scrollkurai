import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RECOVERY_WINDOW_HOURS = 24;
const REMINDER_HOURS_BEFORE = 3;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find users who:
    // 1. Have a lost streak (streak_lost_at is set)
    // 2. Are approaching the 24-hour window (about 3 hours left)
    // 3. Haven't received a streak_insurance_reminder notification yet
    const now = new Date();
    const reminderThresholdStart = new Date(now.getTime() - (RECOVERY_WINDOW_HOURS - REMINDER_HOURS_BEFORE) * 60 * 60 * 1000);
    const reminderThresholdEnd = new Date(now.getTime() - (RECOVERY_WINDOW_HOURS - REMINDER_HOURS_BEFORE - 1) * 60 * 60 * 1000);

    console.log('Checking for streak insurance reminders:', {
      thresholdStart: reminderThresholdStart.toISOString(),
      thresholdEnd: reminderThresholdEnd.toISOString(),
    });

    // Get users with lost streaks in the reminder window
    const { data: usersWithLostStreaks, error: usersError } = await supabase
      .from('profiles')
      .select('id, username, streak_lost_at, last_streak_count')
      .not('streak_lost_at', 'is', null)
      .not('last_streak_count', 'is', null)
      .gte('streak_lost_at', reminderThresholdStart.toISOString())
      .lt('streak_lost_at', reminderThresholdEnd.toISOString());

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return new Response(JSON.stringify({ error: 'Failed to fetch users' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!usersWithLostStreaks || usersWithLostStreaks.length === 0) {
      console.log('No users need streak insurance reminders');
      return new Response(JSON.stringify({ 
        sent: 0,
        message: 'No reminders needed' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let sentCount = 0;

    for (const user of usersWithLostStreaks) {
      // Check if reminder was already sent for this streak loss
      const { data: existingReminder, error: reminderCheckError } = await supabase
        .from('notification_history')
        .select('id')
        .eq('user_id', user.id)
        .eq('event_type', 'streak_insurance_reminder')
        .gte('sent_at', user.streak_lost_at)
        .limit(1);

      if (reminderCheckError) {
        console.error('Error checking existing reminder:', reminderCheckError);
        continue;
      }

      if (existingReminder && existingReminder.length > 0) {
        console.log('Reminder already sent for user:', user.id);
        continue;
      }

      // Check if user has Streak Insurance available
      const { data: hasInsurance, error: insuranceError } = await supabase
        .from('user_power_ups')
        .select('id, power_ups!inner(effect_type)')
        .eq('user_id', user.id)
        .is('used_at', null)
        .eq('power_ups.effect_type', 'streak_protection')
        .limit(1);

      if (insuranceError) {
        console.error('Error checking insurance:', insuranceError);
        continue;
      }

      // Get push token
      const { data: tokenData, error: tokenError } = await supabase
        .from('push_notification_tokens')
        .select('push_token')
        .eq('user_id', user.id)
        .maybeSingle();

      // Calculate time remaining
      const streakLostAt = new Date(user.streak_lost_at);
      const expiresAt = new Date(streakLostAt.getTime() + RECOVERY_WINDOW_HOURS * 60 * 60 * 1000);
      const hoursRemaining = Math.max(0, (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60));
      const hoursRounded = Math.floor(hoursRemaining);
      const minutesRemaining = Math.floor((hoursRemaining - hoursRounded) * 60);

      const title = '⏳ Streak Recovery Expiring Soon!';
      const message = hasInsurance && hasInsurance.length > 0
        ? `Your ${user.last_streak_count}-day streak can still be saved! Use your Streak Insurance before time runs out (${hoursRounded}h ${minutesRemaining}m left).`
        : `Your ${user.last_streak_count}-day streak can still be recovered! Only ${hoursRounded}h ${minutesRemaining}m left to get Streak Insurance.`;

      console.log('Sending streak reminder:', {
        userId: user.id,
        username: user.username,
        hasInsurance: hasInsurance && hasInsurance.length > 0,
        hoursRemaining,
      });

      // Log notification
      const { error: logError } = await supabase
        .from('notification_history')
        .insert({
          user_id: user.id,
          event_type: 'streak_insurance_reminder',
          event_context: {
            streak_count: user.last_streak_count,
            hours_remaining: hoursRemaining,
            has_insurance: hasInsurance && hasInsurance.length > 0,
          },
        });

      if (logError) {
        console.error('Error logging notification:', logError);
      }

      // If has push token, would send push notification here
      if (tokenData?.push_token) {
        console.log('Would send push notification:', {
          token: tokenData.push_token,
          title,
          message,
        });
      }

      sentCount++;
    }

    return new Response(JSON.stringify({ 
      sent: sentCount,
      message: `Sent ${sentCount} streak insurance reminders` 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in send-streak-reminder:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
