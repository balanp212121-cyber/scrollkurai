import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Reminder windows: notify when power-up expires in X hours
const REMINDER_WINDOWS = [1, 3]; // 1 hour and 3 hours before expiry

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    let remindersSent = 0;

    console.log('Checking for power-up expiry reminders at:', now.toISOString());

    // Find users with XP Boosters expiring soon
    const { data: xpBoosterUsers, error: xpError } = await supabase
      .from('profiles')
      .select('id, username, xp_booster_expires_at')
      .eq('xp_booster_active', true)
      .not('xp_booster_expires_at', 'is', null);

    if (xpError) {
      console.error('Error fetching XP booster users:', xpError);
    }

    // Find users with Streak Freeze expiring soon
    const { data: streakFreezeUsers, error: freezeError } = await supabase
      .from('profiles')
      .select('id, username, streak_freeze_expires_at')
      .eq('streak_freeze_active', true)
      .not('streak_freeze_expires_at', 'is', null);

    if (freezeError) {
      console.error('Error fetching streak freeze users:', freezeError);
    }

    // Process XP Booster expiry reminders
    if (xpBoosterUsers) {
      for (const user of xpBoosterUsers) {
        const expiresAt = new Date(user.xp_booster_expires_at);
        const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

        // Check if we should send a reminder
        for (const windowHours of REMINDER_WINDOWS) {
          // Send reminder if expiry is within window +/- 15 minutes
          if (hoursUntilExpiry > windowHours - 0.25 && hoursUntilExpiry <= windowHours + 0.25) {
            const sent = await sendExpiryReminder(
              supabase,
              user.id,
              user.username,
              'xp_booster',
              Math.round(hoursUntilExpiry * 60) // minutes until expiry
            );
            if (sent) remindersSent++;
            break;
          }
        }
      }
    }

    // Process Streak Freeze expiry reminders
    if (streakFreezeUsers) {
      for (const user of streakFreezeUsers) {
        const expiresAt = new Date(user.streak_freeze_expires_at);
        const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

        // Check if we should send a reminder
        for (const windowHours of REMINDER_WINDOWS) {
          if (hoursUntilExpiry > windowHours - 0.25 && hoursUntilExpiry <= windowHours + 0.25) {
            const sent = await sendExpiryReminder(
              supabase,
              user.id,
              user.username,
              'streak_freeze',
              Math.round(hoursUntilExpiry * 60)
            );
            if (sent) remindersSent++;
            break;
          }
        }
      }
    }

    console.log(`Power-up expiry reminders sent: ${remindersSent}`);

    return new Response(
      JSON.stringify({
        success: true,
        reminders_sent: remindersSent,
        checked_at: now.toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in send-powerup-expiry-reminder:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function sendExpiryReminder(
  supabase: any,
  userId: string,
  username: string | null,
  powerUpType: 'xp_booster' | 'streak_freeze',
  minutesUntilExpiry: number
): Promise<boolean> {
  const eventType = `${powerUpType}_expiring`;
  
  // Check if we already sent this reminder today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const { data: existingReminder, error: checkError } = await supabase
    .from('notification_history')
    .select('id')
    .eq('user_id', userId)
    .eq('event_type', eventType)
    .gte('sent_at', todayStart.toISOString())
    .limit(1);

  if (checkError) {
    console.error('Error checking existing reminder:', checkError);
  }

  if (existingReminder && existingReminder.length > 0) {
    console.log(`Already sent ${eventType} reminder to user ${userId} today`);
    return false;
  }

  // Get push token
  const { data: tokenData, error: tokenError } = await supabase
    .from('push_notification_tokens')
    .select('push_token')
    .eq('user_id', userId)
    .maybeSingle();

  if (tokenError || !tokenData) {
    console.log(`No push token for user ${userId}`);
    return false;
  }

  // Generate message
  const displayName = username || 'Warrior';
  const timeText = minutesUntilExpiry >= 60 
    ? `${Math.round(minutesUntilExpiry / 60)} hour${Math.round(minutesUntilExpiry / 60) !== 1 ? 's' : ''}`
    : `${minutesUntilExpiry} minute${minutesUntilExpiry !== 1 ? 's' : ''}`;

  let title: string;
  let message: string;

  if (powerUpType === 'xp_booster') {
    title = '⚡ XP Booster Expiring Soon!';
    message = `Hey ${displayName}! Your 2× XP Booster expires in ${timeText}. Complete quests now to maximize your XP gains!`;
  } else {
    title = '❄️ Streak Freeze Expiring Soon!';
    message = `${displayName}, your Streak Freeze expires in ${timeText}. Complete today's quest to keep your streak safe!`;
  }

  // Log the notification (in production, this would send via FCM/APNs)
  console.log('Sending power-up expiry reminder:', {
    userId,
    powerUpType,
    minutesUntilExpiry,
    title,
    message,
    token: tokenData.push_token.substring(0, 20) + '...',
  });

  // Record in notification history
  const { error: logError } = await supabase.from('notification_history').insert({
    user_id: userId,
    event_type: eventType,
    event_context: {
      power_up_type: powerUpType,
      minutes_until_expiry: minutesUntilExpiry,
    },
  });

  if (logError) {
    console.error('Error logging notification:', logError);
    return false;
  }

  return true;
}
