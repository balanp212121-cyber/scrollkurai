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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Checking for expiring subscriptions...');

    // Find subscriptions expiring in 5 days
    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
    const fiveDaysStart = new Date(fiveDaysFromNow);
    fiveDaysStart.setHours(0, 0, 0, 0);
    const fiveDaysEnd = new Date(fiveDaysFromNow);
    fiveDaysEnd.setHours(23, 59, 59, 999);

    const { data: expiringSubscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('user_id, expires_at, tier')
      .eq('status', 'active')
      .eq('tier', 'premium')
      .gte('expires_at', fiveDaysStart.toISOString())
      .lte('expires_at', fiveDaysEnd.toISOString());

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      throw subError;
    }

    console.log(`Found ${expiringSubscriptions?.length || 0} subscriptions expiring in 5 days`);

    const results = {
      total: expiringSubscriptions?.length || 0,
      notified: 0,
      skipped: 0,
      errors: 0,
    };

    for (const subscription of expiringSubscriptions || []) {
      try {
        // Check if we already sent a renewal reminder in last 24 hours
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: existingNotification } = await supabase
          .from('notification_history')
          .select('id')
          .eq('user_id', subscription.user_id)
          .eq('event_type', 'subscription_expiring')
          .gte('sent_at', twentyFourHoursAgo)
          .limit(1);

        if (existingNotification && existingNotification.length > 0) {
          console.log(`Skipping user ${subscription.user_id} - already notified`);
          results.skipped++;
          continue;
        }

        // Get user profile for personalized message
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', subscription.user_id)
          .maybeSingle();

        const username = profile?.username || 'Warrior';
        const expiresAt = new Date(subscription.expires_at);
        const daysRemaining = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

        // Create notification in community posts (user notification)
        const { error: postError } = await supabase.from('community_posts').insert({
          user_id: subscription.user_id,
          content: `⚠️ Hey ${username}! Your ScrollKurai Pro expires in ${daysRemaining} days (${expiresAt.toLocaleDateString()}). Renew now to keep your premium themes, badges, and power-ups! 👑`,
          is_anonymous: false,
          quest_content: null,
        });

        if (postError) {
          console.error('Error creating notification post:', postError);
        }

        // Log notification in history
        const { error: historyError } = await supabase.from('notification_history').insert({
          user_id: subscription.user_id,
          event_type: 'subscription_expiring',
          event_context: {
            days_remaining: daysRemaining,
            expires_at: subscription.expires_at,
          },
        });

        if (historyError) {
          console.error('Error logging notification:', historyError);
        }

        // Try to send push notification via existing smart notification function
        const { data: tokenData } = await supabase
          .from('push_notification_tokens')
          .select('push_token')
          .eq('user_id', subscription.user_id)
          .maybeSingle();

        if (tokenData?.push_token) {
          console.log(`Would send push notification to user ${subscription.user_id}:`, {
            title: 'Premium Expiring Soon! ⚠️',
            message: `Your ScrollKurai Pro expires in ${daysRemaining} days. Renew to keep your premium features!`,
          });
        }

        console.log(`Notified user ${subscription.user_id} about expiring subscription`);
        results.notified++;

      } catch (userError) {
        console.error(`Error processing user ${subscription.user_id}:`, userError);
        results.errors++;
      }
    }

    console.log('Renewal check complete:', results);

    return new Response(JSON.stringify({
      success: true,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in check-subscription-renewals:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
