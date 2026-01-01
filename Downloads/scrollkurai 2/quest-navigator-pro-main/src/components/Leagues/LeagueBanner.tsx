import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LeagueBannerProps {
  userId: string;
}

const TIER_COLORS: Record<string, string> = {
  bronze: "from-amber-700 to-amber-900",
  silver: "from-gray-400 to-gray-600",
  gold: "from-yellow-400 to-yellow-600",
  platinum: "from-cyan-400 to-cyan-600",
  diamond: "from-purple-400 to-purple-600",
};

const TIER_NAMES: Record<string, string> = {
  bronze: "Bronze League",
  silver: "Silver League",
  gold: "Gold League",
  platinum: "Platinum League",
  diamond: "Diamond League",
};

const TIER_ICONS: Record<string, string> = {
  bronze: "🥉",
  silver: "🥈",
  gold: "🥇",
  platinum: "💎",
  diamond: "👑",
};

export const LeagueBanner = ({ userId }: LeagueBannerProps) => {
  const [leagueTier, setLeagueTier] = useState<string | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeagueData();
  }, [userId]);

  const fetchLeagueData = async () => {
    try {
      // Get user's current league
      const { data: userLeague, error: leagueError } = await supabase
        .from('user_leagues')
        .select('league_tier')
        .eq('user_id', userId)
        .single();

      if (leagueError) {
        console.error('Error fetching league:', leagueError);
        return;
      }

      setLeagueTier(userLeague?.league_tier || 'bronze');

      // Get current week
      const { data: weekId, error: weekError } = await supabase.rpc('get_current_league_week');
      if (weekError) {
        console.error('Error getting week:', weekError);
        return;
      }

      // Get leaderboard to compute rank dynamically (since rank is null until weekly processing)
      const tier = userLeague?.league_tier || 'bronze';
      const { data: leaderboard, error: leaderboardError } = await supabase.rpc('get_league_leaderboard', {
        league_tier_param: tier as 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond',
        week_id_param: weekId,
      });

      if (leaderboardError) {
        console.error('Error fetching leaderboard:', leaderboardError);
        return;
      }

      // Find user's rank from the sorted leaderboard
      const userIndex = (leaderboard || []).findIndex((entry: { user_id: string }) => entry.user_id === userId);
      if (userIndex !== -1) {
        setRank(userIndex + 1);
      } else {
        setRank(null);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !leagueTier) {
    return null;
  }

  return (
    <Card className={`p-4 bg-gradient-to-r ${TIER_COLORS[leagueTier]} border-none`}>
      <div className="flex items-center justify-between text-white">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{TIER_ICONS[leagueTier]}</span>
          <div>
            <p className="font-bold text-lg">{TIER_NAMES[leagueTier]}</p>
            <p className="text-sm opacity-90">
              {rank ? `Rank #${rank}` : 'Complete a quest to join'}
            </p>
          </div>
        </div>
        <Trophy className="w-8 h-8 opacity-80" />
      </div>
    </Card>
  );
};
