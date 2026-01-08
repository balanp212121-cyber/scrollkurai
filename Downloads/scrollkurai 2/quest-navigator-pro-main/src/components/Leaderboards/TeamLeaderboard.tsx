import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Flame, Crown, Swords, Clock, Loader2 } from "lucide-react";

interface LeaderboardEntry {
    team_id: string;
    team_name: string;
    rank: number;
    score: number;
    total_xp: number;
    quests_completed: number;
    current_streak: number;
    league_tier: string;
}

interface Season {
    id: string;
    name: string;
    end_date: string;
    status: string;
}

export function TeamLeaderboard() {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [season, setSeason] = useState<Season | null>(null);
    const [loading, setLoading] = useState(true);
    const [myTeamId, setMyTeamId] = useState<string | null>(null);

    useEffect(() => {
        fetchLeaderboard();
        fetchMyTeam();
    }, []);

    const fetchLeaderboard = async () => {
        try {
            // Get active season
            const { data: seasonData } = await supabase
                .from('seasons')
                .select('*')
                .eq('status', 'active')
                .single();

            if (seasonData) {
                setSeason(seasonData);

                // Get leaderboard
                const { data: leaderboard } = await supabase
                    .from('team_leaderboard_cache')
                    .select('*')
                    .eq('season_id', seasonData.id)
                    .order('rank', { ascending: true })
                    .limit(50);

                setEntries(leaderboard || []);
            }
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMyTeam = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: membership } = await supabase
                .from('team_members')
                .select('team_id')
                .eq('user_id', user.id)
                .limit(1)
                .single();

            if (membership) {
                setMyTeamId(membership.team_id);
            }
        } catch (error) {
            console.error('Error fetching team:', error);
        }
    };

    const getTimeRemaining = (): string => {
        if (!season) return '';
        const end = new Date(season.end_date);
        const now = new Date();
        const diff = end.getTime() - now.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        return `${days} days remaining`;
    };

    const getRankStyle = (rank: number) => {
        switch (rank) {
            case 1:
                return 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black';
            case 2:
                return 'bg-gradient-to-r from-gray-300 to-gray-400 text-black';
            case 3:
                return 'bg-gradient-to-r from-orange-400 to-orange-500 text-white';
            default:
                return 'bg-muted text-muted-foreground';
        }
    };

    const getTierColor = (tier: string) => {
        switch (tier?.toLowerCase()) {
            case 'diamond':
                return 'bg-cyan-500/20 text-cyan-400 border-cyan-400';
            case 'platinum':
                return 'bg-purple-500/20 text-purple-400 border-purple-400';
            case 'gold':
                return 'bg-yellow-500/20 text-yellow-400 border-yellow-400';
            case 'silver':
                return 'bg-gray-400/20 text-gray-300 border-gray-400';
            default:
                return 'bg-orange-600/20 text-orange-400 border-orange-400';
        }
    };

    if (loading) {
        return (
            <Card className="p-6">
                <div className="flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin" />
                </div>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Season Header */}
            {season && (
                <Card className="p-4 bg-gradient-to-r from-primary/10 to-accent/10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Trophy className="h-6 w-6 text-primary" />
                            <div>
                                <h2 className="font-bold text-lg">{season.name}</h2>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Clock className="h-4 w-4" />
                                    {getTimeRemaining()}
                                </div>
                            </div>
                        </div>
                        <Badge className="bg-primary/20 text-primary">
                            Active Season
                        </Badge>
                    </div>
                </Card>
            )}

            {/* Leaderboard */}
            <Card className="overflow-hidden">
                <div className="p-4 border-b bg-gradient-to-r from-primary/5 to-accent/5">
                    <h3 className="font-semibold flex items-center gap-2">
                        <Crown className="h-5 w-5 text-yellow-500" />
                        Team Leaderboard
                    </h3>
                </div>

                <ScrollArea className="h-[500px]">
                    {entries.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                            <Trophy className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p>No teams ranked yet this season</p>
                            <p className="text-sm mt-1">Complete team quests to appear on the leaderboard!</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {entries.map((entry) => (
                                <div
                                    key={entry.team_id}
                                    className={`p-4 flex items-center gap-4 transition-colors
                    ${entry.team_id === myTeamId ? 'bg-primary/5 border-l-4 border-l-primary' : 'hover:bg-muted/50'}`}
                                >
                                    {/* Rank */}
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${getRankStyle(entry.rank)}`}>
                                        {entry.rank <= 3 ? (
                                            entry.rank === 1 ? '👑' : entry.rank === 2 ? '🥈' : '🥉'
                                        ) : entry.rank}
                                    </div>

                                    {/* Team Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold truncate">{entry.team_name}</span>
                                            {entry.team_id === myTeamId && (
                                                <Badge variant="outline" className="text-xs">Your Team</Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                            <span>{entry.total_xp.toLocaleString()} XP</span>
                                            <span>{entry.quests_completed} quests</span>
                                        </div>
                                    </div>

                                    {/* Streak */}
                                    {entry.current_streak > 0 && (
                                        <div className="flex items-center gap-1 text-orange-500">
                                            <Flame className="h-4 w-4" />
                                            <span className="font-bold text-sm">{entry.current_streak}</span>
                                        </div>
                                    )}

                                    {/* Tier */}
                                    <Badge variant="outline" className={`${getTierColor(entry.league_tier)}`}>
                                        {entry.league_tier}
                                    </Badge>

                                    {/* Score */}
                                    <div className="text-right">
                                        <p className="font-bold text-lg">{entry.score.toLocaleString()}</p>
                                        <p className="text-xs text-muted-foreground">score</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </Card>
        </div>
    );
}
