import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Hook to trigger streak-based rewards when user completes quests
 * Called after quest completion to check if user hit 7-day or 10-day milestone
 */
export function useStreakRewards() {
    const checkAndGrantReward = useCallback(async (streakCount: number) => {
        // Only check for milestone streaks
        if (streakCount !== 7 && streakCount !== 10) {
            return null;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            const { data, error } = await (supabase.rpc as any)("grant_streak_reward", {
                p_user_id: user.id,
                p_streak_count: streakCount,
            });

            if (error) {
                console.error("Error granting streak reward:", error);
                return null;
            }

            if (data?.granted) {
                // Show celebration toast
                if (streakCount === 7) {
                    toast.success("🎉 7-Day Streak Reward!", {
                        description: "You've unlocked a 20% discount coupon! Valid for 72 hours.",
                        duration: 8000,
                    });
                } else if (streakCount === 10) {
                    toast.success("🔥 10-Day Streak!", {
                        description: "Triple quest unlocked today only! Complete 3 quests.",
                        duration: 8000,
                    });
                }

                return data;
            }

            return null;
        } catch (error) {
            console.error("Error in streak rewards:", error);
            return null;
        }
    }, []);

    // Random surprise drop (5-10% chance)
    const checkSurpriseDrop = useCallback(async () => {
        const chance = Math.random();
        if (chance > 0.08) return null; // ~8% chance

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            // Grant a random surprise
            const surprises = [
                { type: "surprise_powerup", value: { power_ups: 1 }, message: "🎁 Surprise! Free Power-Up unlocked!" },
                { type: "surprise_xp_boost", value: { xp_multiplier: 2, hours: 12 }, message: "⚡ Surprise! 2× XP for 12 hours!" },
            ];

            const surprise = surprises[Math.floor(Math.random() * surprises.length)];

            // Check if already received today
            const { data: existing } = await supabase
                .from("reward_grants")
                .select("id")
                .eq("user_id", user.id)
                .eq("reward_type", surprise.type)
                .gte("granted_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
                .maybeSingle();

            if (existing) return null;

            // Grant the surprise
            await supabase.from("reward_grants").insert({
                user_id: user.id,
                reward_type: surprise.type,
                reward_value: surprise.value,
                trigger_streak: 0,
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            });

            toast.success(surprise.message, {
                description: "Open your rewards to claim!",
                duration: 6000,
            });

            return surprise;
        } catch (error) {
            console.error("Error in surprise drop:", error);
            return null;
        }
    }, []);

    return { checkAndGrantReward, checkSurpriseDrop };
}
