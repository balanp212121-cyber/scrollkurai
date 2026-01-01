import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const LeaderboardInsights = () => {
  const [leagueData, setLeagueData] = useState<any>(null);
  const [nearby, setNearby] = useState<any[]>([]);

  useEffect(() => {
    fetchLeagueData();
  }, []);

  const fetchLeagueData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get user's league
    const { data: userLeague } = await supabase
      .from('user_leagues')
      .select('league_tier')
      .eq('user_id', user.id)
      .single();

    if (userLeague) {
      // Get leaderboard
      const { data: leaderboard } = await supabase.rpc('get_league_leaderboard', {
        league_tier_param: userLeague.league_tier,
      });

      if (leaderboard) {
        // Compute ranks dynamically since DB rank is null until weekly processing
        const rankedLeaderboard = leaderboard.map((entry: any, index: number) => ({
          ...entry,
          rank: entry.rank ?? index + 1,
        }));
        
        const userRank = rankedLeaderboard.findIndex((u: any) => u.user_id === user.id);
        
        // Get nearby users (2 above, user, 2 below)
        const start = Math.max(0, userRank - 2);
        const end = Math.min(rankedLeaderboard.length, userRank + 3);
        const nearbyUsers = rankedLeaderboard.slice(start, end);

        setNearby(nearbyUsers);
        setLeagueData({
          tier: userLeague.league_tier,
          rank: userRank + 1,
          total: rankedLeaderboard.length
        });
      }
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Trophy className="w-5 h-5 text-primary" />
        League Position
      </h2>

      {leagueData && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Your Rank</p>
              <p className="text-2xl font-bold">#{leagueData.rank}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">League</p>
              <p className="text-lg font-semibold capitalize">{leagueData.tier}</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Nearby Competitors</p>
            {nearby.map((entry: any, index: number) => (
              <div
                key={entry.user_id}
                className="flex items-center gap-3 p-2 rounded-lg bg-muted/30"
              >
                <span className="text-sm font-semibold text-muted-foreground w-6">
                  #{entry.rank}
                </span>
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/20 text-primary text-xs">
                    {entry.username?.charAt(0).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 text-sm">{entry.username}</span>
                <span className="text-sm font-semibold text-primary">
                  {entry.xp_earned} XP
                </span>
                {entry.rank <= 10 && (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                )}
                {entry.rank > nearby.length - 5 && (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};
