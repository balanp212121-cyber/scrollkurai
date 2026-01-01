import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Gift, Tag, Zap, Clock, X } from "lucide-react";

interface Reward {
    id: string;
    reward_type: string;
    reward_value: any;
    expires_at: string;
    hours_remaining: number;
}

interface Coupon {
    id: string;
    code: string;
    discount_percent: number;
    applies_to: string[];
    expires_at: string;
    hours_remaining: number;
}

const REWARD_CONFIG: Record<string, {
    title: string;
    description: string;
    icon: typeof Gift;
    color: string;
}> = {
    discount_7day: {
        title: "🎉 7-Day Streak Reward!",
        description: "20% off your next purchase",
        icon: Tag,
        color: "bg-green-500/20 border-green-500/50",
    },
    triple_quest_10day: {
        title: "🔥 10-Day Streak!",
        description: "Complete 3 quests today",
        icon: Zap,
        color: "bg-amber-500/20 border-amber-500/50",
    },
    surprise_powerup: {
        title: "🎁 Surprise Drop!",
        description: "You got a free power-up",
        icon: Gift,
        color: "bg-purple-500/20 border-purple-500/50",
    },
};

export function ActiveRewardsBanner() {
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchActiveRewards();
    }, []);

    const fetchActiveRewards = async () => {
        try {
            const { data: rewardData } = await (supabase.rpc as any)("get_active_rewards");
            const { data: couponData } = await (supabase.rpc as any)("get_active_coupons");

            if (rewardData) setRewards(rewardData);
            if (couponData) setCoupons(couponData);
        } catch (error) {
            console.error("Error fetching rewards:", error);
        }
    };

    const dismiss = (id: string) => {
        setDismissed(prev => new Set([...prev, id]));
    };

    const formatTimeRemaining = (hours: number) => {
        if (hours < 1) return "< 1 hour left";
        if (hours < 24) return `${hours}h left`;
        return `${Math.floor(hours / 24)}d left`;
    };

    const visibleRewards = rewards.filter(r => !dismissed.has(r.id));
    const visibleCoupons = coupons.filter(c => !dismissed.has(c.id));

    if (visibleRewards.length === 0 && visibleCoupons.length === 0) {
        return null;
    }

    return (
        <div className="space-y-3">
            {/* Streak Rewards */}
            {visibleRewards.map((reward) => {
                const config = REWARD_CONFIG[reward.reward_type] || REWARD_CONFIG.surprise_powerup;
                const Icon = config.icon;

                return (
                    <Card
                        key={reward.id}
                        className={`p-4 ${config.color} relative overflow-hidden`}
                    >
                        <button
                            onClick={() => dismiss(reward.id)}
                            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-full bg-white/20">
                                <Icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold">{config.title}</h3>
                                <p className="text-sm text-muted-foreground">{config.description}</p>
                                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                    <Clock className="w-3 h-3" />
                                    {formatTimeRemaining(reward.hours_remaining)}
                                </div>
                            </div>
                        </div>
                    </Card>
                );
            })}

            {/* Discount Coupons */}
            {visibleCoupons.map((coupon) => (
                <Card
                    key={coupon.id}
                    className="p-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/50 relative"
                >
                    <button
                        onClick={() => dismiss(coupon.id)}
                        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-green-500/30">
                                <Tag className="w-5 h-5 text-green-500" />
                            </div>
                            <div>
                                <h3 className="font-bold text-green-500">{coupon.discount_percent}% OFF</h3>
                                <p className="text-xs text-muted-foreground">
                                    Applies to: {coupon.applies_to.join(", ")}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <Badge variant="outline" className="font-mono text-xs">
                                {coupon.code}
                            </Badge>
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {formatTimeRemaining(coupon.hours_remaining)}
                            </div>
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
}
