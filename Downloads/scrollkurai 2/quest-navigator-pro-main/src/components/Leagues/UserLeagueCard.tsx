import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, ChevronUp, ChevronDown, Minus, Loader2 } from "lucide-react";

interface LeagueInfo {
    tier: string;
    points: number;
    weekly_quests: number;
    weekly_xp: number;
    rank: number;
    tier_total: number;
}

const TIER_CONFIG: Record<string, { color: string; next: string; promotionXP: number }> = {
    Bronze: { color: 'from-orange-600 to-orange-400', next: 'Silver', promotionXP: 500 },
    Silver: { color: 'from-gray-400 to-gray-200', next: 'Gold', promotionXP: 1000 },
    Gold: { color: 'from-yellow-500 to-amber-400', next: 'Platinum', promotionXP: 2000 },
    Platinum: { color: 'from-purple-500 to-purple-300', next: 'Diamond', promotionXP: 4000 },
    Diamond: { color: 'from-cyan-400 to-blue-500', next: '', promotionXP: 0 },
};

export function UserLeagueCard() {
    const [info, setInfo] = useState<LeagueInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLeagueInfo();
    }, []);

    const fetchLeagueInfo = async () => {
        try {
            const { data, error } = await supabase.rpc('get_user_league_info');
            if (error) throw error;
            if (data?.success) {
                setInfo(data);
            }
        } catch (error) {
            console.error('Error fetching league info:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Card className="p-4">
                <div className="flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin" />
                </div>
            </Card>
        );
    }

    if (!info) {
        return null;
    }

    const config = TIER_CONFIG[info.tier] || TIER_CONFIG.Bronze;
    const progressPercent = config.promotionXP > 0
        ? Math.min((info.weekly_xp / config.promotionXP) * 100, 100)
        : 100;

    return (
        <Card className="overflow-hidden">
            {/* Tier Header */}
            <div className={`p-4 bg-gradient-to-r ${config.color}`}>
                <div className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-3">
                        <Trophy className="h-8 w-8" />
                        <div>
                            <h3 className="font-bold text-lg">{info.tier} League</h3>
                            <p className="text-sm opacity-90">
                                Rank #{info.rank} of {info.tier_total}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-bold">{info.points.toLocaleString()}</p>
                        <p className="text-xs opacity-90">Total Points</p>
                    </div>
                </div>
            </div>

            {/* Weekly Progress */}
            <div className="p-4 space-y-4">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">This Week</span>
                    <div className="flex items-center gap-4">
                        <span>{info.weekly_quests} quests</span>
                        <span className="font-medium">{info.weekly_xp} XP</span>
                    </div>
                </div>

                {/* Promotion Progress */}
                {config.next && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                                Progress to {config.next}
                            </span>
                            <span className="font-medium">
                                {info.weekly_xp} / {config.promotionXP} XP
                            </span>
                        </div>
                        <Progress value={progressPercent} className="h-2" />
                    </div>
                )}

                {/* Promotion/Demotion Zones */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                    <div className="text-center p-2 bg-green-500/10 rounded">
                        <ChevronUp className="h-4 w-4 text-green-500 mx-auto" />
                        <p className="text-xs text-green-500">Top 20%</p>
                        <p className="text-xs text-muted-foreground">Promote</p>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded">
                        <Minus className="h-4 w-4 text-muted-foreground mx-auto" />
                        <p className="text-xs text-muted-foreground">Middle</p>
                        <p className="text-xs text-muted-foreground">Stay</p>
                    </div>
                    <div className="text-center p-2 bg-red-500/10 rounded">
                        <ChevronDown className="h-4 w-4 text-red-500 mx-auto" />
                        <p className="text-xs text-red-500">Bottom 20%</p>
                        <p className="text-xs text-muted-foreground">Demote</p>
                    </div>
                </div>

                <p className="text-xs text-center text-muted-foreground">
                    Complete quests to climb the leaderboard!
                </p>
            </div>
        </Card>
    );
}
