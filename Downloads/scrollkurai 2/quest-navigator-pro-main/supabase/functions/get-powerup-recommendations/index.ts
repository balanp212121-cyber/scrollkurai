import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Recommendation {
    power_up_id: string;
    power_up_name: string;
    power_up_icon: string;
    reason: string;
    confidence_score: number;
    expires_at: string;
}

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

        // Get current user
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        if (userError || !user) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized', recommendations: [] }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Fetch user profile
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('streak, last_quest_date, xp_booster_active, streak_freeze_active, premium_status')
            .eq('id', user.id)
            .single();

        if (!profile) {
            return new Response(
                JSON.stringify({ recommendations: [] }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Fetch user's power-up inventory
        const { data: inventory } = await supabaseClient
            .from('user_power_ups')
            .select('*, power_ups(*)')
            .eq('user_id', user.id)
            .is('used_at', null);

        // Calculate recommendations
        const recommendations: Recommendation[] = [];
        const now = new Date();
        const todayIST = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        const currentHourIST = parseInt(now.toLocaleTimeString('en-US', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            hour12: false
        }));

        // Check streak risk
        const lastQuestDate = profile.last_quest_date;
        const yesterdayIST = new Date(now.getTime() - 24 * 60 * 60 * 1000)
            .toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

        // Find available power-ups in inventory
        const hasStreakFreeze = inventory?.some(i => i.power_ups?.effect_type === 'streak_save');
        const hasXPBooster = inventory?.some(i => i.power_ups?.effect_type === 'xp_multiplier');

        // --- RECOMMENDATION RULES ---

        // 1. Streak at risk: Missed yesterday, has streak > 3, has streak freeze
        if (
            lastQuestDate !== todayIST &&
            lastQuestDate !== yesterdayIST &&
            profile.streak > 3 &&
            hasStreakFreeze &&
            !profile.streak_freeze_active
        ) {
            const freezePowerUp = inventory?.find(i => i.power_ups?.effect_type === 'streak_save');
            if (freezePowerUp?.power_ups) {
                recommendations.push({
                    power_up_id: freezePowerUp.power_up_id,
                    power_up_name: freezePowerUp.power_ups.name,
                    power_up_icon: freezePowerUp.power_ups.icon,
                    reason: `Your ${profile.streak}-day streak is at risk! Use Streak Freeze to protect it.`,
                    confidence_score: 0.95,
                    expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
                });
            }
        }

        // 2. High momentum: Completed today AND yesterday, has XP booster
        if (
            lastQuestDate === todayIST ||
            lastQuestDate === yesterdayIST
        ) {
            if (hasXPBooster && !profile.xp_booster_active && profile.streak >= 3) {
                const xpPowerUp = inventory?.find(i => i.power_ups?.effect_type === 'xp_multiplier');
                if (xpPowerUp?.power_ups) {
                    recommendations.push({
                        power_up_id: xpPowerUp.power_up_id,
                        power_up_name: xpPowerUp.power_ups.name,
                        power_up_icon: xpPowerUp.power_ups.icon,
                        reason: `You're on a roll with a ${profile.streak}-day streak! Maximize your XP gains.`,
                        confidence_score: 0.75,
                        expires_at: new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString()
                    });
                }
            }
        }

        // 3. Evening focus time (6-10 PM IST)
        if (currentHourIST >= 18 && currentHourIST <= 22 && hasXPBooster && !profile.xp_booster_active) {
            const xpPowerUp = inventory?.find(i => i.power_ups?.effect_type === 'xp_multiplier');
            if (xpPowerUp?.power_ups && !recommendations.some(r => r.power_up_id === xpPowerUp.power_up_id)) {
                recommendations.push({
                    power_up_id: xpPowerUp.power_up_id,
                    power_up_name: xpPowerUp.power_ups.name,
                    power_up_icon: xpPowerUp.power_ups.icon,
                    reason: `Evening is prime focus time! Boost your XP for the next quest.`,
                    confidence_score: 0.50,
                    expires_at: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString()
                });
            }
        }

        // Sort by confidence score
        recommendations.sort((a, b) => b.confidence_score - a.confidence_score);

        // Return top 2 recommendations max
        return new Response(
            JSON.stringify({
                recommendations: recommendations.slice(0, 2),
                user_context: {
                    streak: profile.streak,
                    has_completed_today: lastQuestDate === todayIST,
                    xp_booster_active: profile.xp_booster_active,
                    streak_freeze_active: profile.streak_freeze_active
                }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: unknown) {
        console.error('Error in get-powerup-recommendations:', error);
        return new Response(
            JSON.stringify({ recommendations: [], error: 'Internal error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
