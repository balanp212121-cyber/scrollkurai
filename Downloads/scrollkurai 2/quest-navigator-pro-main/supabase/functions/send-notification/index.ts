import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
    user_id: string;
    notification_type: 'streak_reminder' | 'streak_loss' | 'purchase_approved' | 'purchase_failed' | 'positive_reinforcement';
    title: string;
    body: string;
    data?: Record<string, any>;
}

// Positive reinforcement messages (random, respectful)
const POSITIVE_MESSAGES = [
    { title: "✨ Keep Going", body: "You're building something powerful. Proud of you." },
    { title: "🚀 Small Steps", body: "Small steps. Big change. You're doing great." },
    { title: "💪 Consistency Wins", body: "Every day you show up, you grow stronger." },
    { title: "🌟 You Matter", body: "Your progress matters. Don't forget that." },
    { title: "🔥 Momentum", body: "You've got momentum. Keep the fire alive." },
];

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        const { user_id, notification_type, title, body, data } = await req.json() as NotificationPayload;

        if (!user_id || !notification_type || !title || !body) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Check rate limits
        const { data: canSend } = await supabaseAdmin.rpc('can_send_notification', { p_user_id: user_id });

        if (!canSend) {
            return new Response(JSON.stringify({
                success: false,
                reason: 'Rate limited or silent hours'
            }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Log the notification
        const { error: logError } = await supabaseAdmin
            .from('notification_logs')
            .insert({
                user_id,
                notification_type,
                title,
                body,
                delivered: true, // In production, this would be updated by push service callback
            });

        if (logError) {
            console.error('Error logging notification:', logError);
        }

        // In production, you would integrate with:
        // - Firebase Cloud Messaging (FCM) for Android
        // - Apple Push Notification Service (APNS) for iOS
        // - Web Push API for web browsers
        //
        // For now, we log the notification and return success
        // The notification will be displayed in-app via the rewards banner

        console.log('Notification sent:', { user_id, notification_type, title, body });

        return new Response(JSON.stringify({
            success: true,
            notification: { title, body, type: notification_type }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error in send-notification:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
