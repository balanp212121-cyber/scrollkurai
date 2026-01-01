import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Sparkles, Crown, Flame, Zap } from "lucide-react";

interface UserBadge {
    badge_id: string;
    name: string;
    icon: string;
    description: string;
    rarity: string;
    category: string;
    is_limited: boolean;
    total_holders: number;
    earned_at: string;
    is_active: boolean;
}

const RARITY_CONFIG: Record<string, { color: string; glow: string; label: string }> = {
    common: { color: "bg-gray-500/20 text-gray-400", glow: "", label: "Common" },
    rare: { color: "bg-blue-500/20 text-blue-400", glow: "shadow-blue-500/20", label: "Rare" },
    epic: { color: "bg-purple-500/20 text-purple-400", glow: "shadow-purple-500/30 shadow-lg", label: "Epic" },
    legendary: { color: "bg-amber-500/20 text-amber-400", glow: "shadow-amber-500/40 shadow-xl", label: "Legendary" },
    ultra_rare: { color: "bg-gradient-to-r from-rose-500/20 to-amber-500/20 text-rose-400", glow: "shadow-rose-500/50 shadow-xl animate-pulse", label: "Ultra Rare" },
};

export function BadgeCollection() {
    const [badges, setBadges] = useState<UserBadge[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchBadges();
    }, []);

    const fetchBadges = async () => {
        try {
            const { data, error } = await (supabase.rpc as any)("get_user_badges");
            if (error) throw error;
            setBadges(data || []);
        } catch (error) {
            console.error("Error fetching badges:", error);
        } finally {
            setLoading(false);
        }
    };

    const rarestBadge = badges.reduce((rarest, badge) => {
        const rarityOrder = ["common", "rare", "epic", "legendary", "ultra_rare"];
        return rarityOrder.indexOf(badge.rarity) > rarityOrder.indexOf(rarest?.rarity || "common")
            ? badge : rarest;
    }, badges[0] || null);

    if (loading) {
        return (
            <Card className="p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-muted rounded w-1/3" />
                    <div className="grid grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-20 bg-muted rounded" />
                        ))}
                    </div>
                </div>
            </Card>
        );
    }

    return (
        <Card className="overflow-hidden">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-primary" />
                    Badge Collection
                    <Badge variant="secondary" className="ml-auto">{badges.length}</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Rarest Badge Highlight */}
                {rarestBadge && (
                    <div className={`p-4 rounded-lg border ${RARITY_CONFIG[rarestBadge.rarity]?.color} ${RARITY_CONFIG[rarestBadge.rarity]?.glow}`}>
                        <div className="flex items-center gap-3">
                            <div className="text-4xl">{rarestBadge.icon}</div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold">{rarestBadge.name}</span>
                                    <Badge className={RARITY_CONFIG[rarestBadge.rarity]?.color}>
                                        {RARITY_CONFIG[rarestBadge.rarity]?.label}
                                    </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{rarestBadge.description}</p>
                                {rarestBadge.is_limited && (
                                    <p className="text-xs text-amber-500 mt-1">
                                        🏆 Only {rarestBadge.total_holders} warriors have this
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Badge Grid */}
                {badges.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <Sparkles className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Complete quests to earn badges!</p>
                        <p className="text-xs mt-1">Your first badge awaits...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
                        {badges.map((badge) => (
                            <div
                                key={badge.badge_id}
                                className={`aspect-square rounded-lg flex flex-col items-center justify-center p-2 border transition-all cursor-pointer hover:scale-105 ${badge.is_active
                                        ? `${RARITY_CONFIG[badge.rarity]?.color} ${RARITY_CONFIG[badge.rarity]?.glow}`
                                        : "bg-muted/50 opacity-50 grayscale"
                                    } ${badge.is_limited ? "ring-2 ring-amber-500/50" : ""}`}
                                title={`${badge.name} - ${badge.description}`}
                            >
                                <div className={`text-2xl ${!badge.is_active && "grayscale"}`}>
                                    {badge.icon}
                                </div>
                                <p className="text-[10px] text-center mt-1 truncate w-full">
                                    {badge.name.split(" ")[0]}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Next Unlock Hint */}
                <div className="pt-4 border-t text-center">
                    <p className="text-xs text-muted-foreground">
                        💡 <em>Complete quests faster to unlock speed badges...</em>
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
