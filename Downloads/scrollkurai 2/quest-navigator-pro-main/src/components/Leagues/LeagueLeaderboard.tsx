import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LeaderboardEntry {
  user_id: string;
  username: string;
  xp_earned: number;
  rank: number;
  league_tier: string;
}

interface CurrentUserPosition {
  rank: number;
  xp_earned: number;
  totalInLeague: number;
}

interface UserAvatar {
  user_id: string;
  avatar_preset: string | null;
  border_color: string | null;
}

const AVATAR_PRESETS: Record<string, string> = {
  warrior: "⚔️",
  sage: "🧙",
  phoenix: "🔥",
  zen: "☯️",
  star: "⭐",
  crown: "👑",
  diamond: "💎",
  rocket: "🚀",
};

const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
const TIER_LABELS: Record<string, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
  diamond: "Diamond",
};

export const LeagueLeaderboard = () => {
  const [selectedTier, setSelectedTier] = useState('bronze');
  const [top10, setTop10] = useState<LeaderboardEntry[]>([]);
  const [currentUserPosition, setCurrentUserPosition] = useState<CurrentUserPosition | null>(null);
  const [avatars, setAvatars] = useState<Record<string, UserAvatar>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserInTop10, setCurrentUserInTop10] = useState(false);

  useEffect(() => {
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      fetchLeaderboard();
    }
  }, [selectedTier, currentUserId]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      // TODO [SCALE 10k+]: Replace with materialized view + Redis cache
      // Current RPC is fine for <10k users but will slow at scale
      // See: https://supabase.com/docs/guides/database/optimization
      const { data, error } = await supabase.rpc('get_league_leaderboard', {
        league_tier_param: selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1), // Convert 'bronze' -> 'Bronze'
      });

      if (error) {
        console.error('Error fetching leaderboard:', error);
        return;
      }

      const allEntries = (data || []).map((entry: LeaderboardEntry, index: number) => ({
        ...entry,
        rank: entry.rank ?? index + 1, // Compute rank if null
      }));
      const totalInLeague = allEntries.length;

      // Get top 10 only
      const topTen = allEntries.slice(0, 10);
      setTop10(topTen);

      // Check if current user is in top 10
      const userInTop10 = topTen.some((e: LeaderboardEntry) => e.user_id === currentUserId);
      setCurrentUserInTop10(userInTop10);

      // If user is not in top 10, find their position
      if (!userInTop10 && currentUserId) {
        const userEntry = allEntries.find((e: LeaderboardEntry) => e.user_id === currentUserId);
        if (userEntry) {
          setCurrentUserPosition({
            rank: userEntry.rank,
            xp_earned: userEntry.xp_earned,
            totalInLeague,
          });
        } else {
          setCurrentUserPosition(null);
        }
      } else {
        setCurrentUserPosition(null);
      }

      // Fetch avatars only for top 10 users
      if (topTen.length > 0) {
        const userIds = topTen.map((l: LeaderboardEntry) => l.user_id);
        const { data: avatarData } = await supabase
          .from("user_avatars")
          .select("user_id, avatar_preset, border_color")
          .in("user_id", userIds);

        if (avatarData) {
          const avatarMap: Record<string, UserAvatar> = {};
          avatarData.forEach((a) => {
            avatarMap[a.user_id] = a;
          });
          setAvatars(avatarMap);
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAvatarDisplay = (userId: string, username: string) => {
    const avatar = avatars[userId];
    if (avatar?.avatar_preset && AVATAR_PRESETS[avatar.avatar_preset]) {
      return AVATAR_PRESETS[avatar.avatar_preset];
    }
    return username?.charAt(0).toUpperCase() || "?";
  };

  const getAvatarBorderStyle = (userId: string) => {
    const avatar = avatars[userId];
    if (avatar?.border_color) {
      return { borderColor: avatar.border_color, borderWidth: "2px" };
    }
    return {};
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Trophy className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Trophy className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="w-5 text-center font-bold text-muted-foreground">#{rank}</span>;
    }
  };

  const getPromotionIndicator = (rank: number) => {
    if (rank <= 10) {
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    }
    return null;
  };

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Trophy className="w-6 h-6 text-primary" />
        League Leaderboard
      </h2>

      <Tabs value={selectedTier} onValueChange={setSelectedTier}>
        <TabsList className="grid w-full grid-cols-5 mb-4">
          {TIER_ORDER.map((tier) => (
            <TabsTrigger key={tier} value={tier}>
              {TIER_LABELS[tier]}
            </TabsTrigger>
          ))}
        </TabsList>

        {TIER_ORDER.map((tier) => (
          <TabsContent key={tier} value={tier}>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {top10.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No participants yet. Complete a quest to join!
                  </p>
                ) : (
                  <>
                    {/* Top 10 Users */}
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {top10.map((entry) => (
                        <div
                          key={entry.user_id}
                          className={`flex items-center gap-3 p-3 rounded-lg transition-all ${entry.user_id === currentUserId
                            ? "bg-primary/20 border border-primary"
                            : "bg-muted/50 hover:bg-muted"
                            }`}
                        >
                          <div className="flex-shrink-0 w-6 flex items-center justify-center">
                            {getRankIcon(entry.rank)}
                          </div>

                          <Avatar
                            className="h-8 w-8"
                            style={getAvatarBorderStyle(entry.user_id)}
                          >
                            <AvatarFallback className="bg-primary/20 text-primary text-sm">
                              {getAvatarDisplay(entry.user_id, entry.username)}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-sm">
                              {entry.username || "Anonymous"}
                              {entry.user_id === currentUserId && (
                                <span className="ml-2 text-xs text-primary">(You)</span>
                              )}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {getPromotionIndicator(entry.rank)}
                            <p className="font-bold text-primary text-sm">
                              {entry.xp_earned} XP
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Current User Position (if not in top 10) */}
                    {!currentUserInTop10 && currentUserPosition && (
                      <div className="mt-4 p-4 bg-primary/10 border border-primary/30 rounded-lg">
                        <p className="text-lg font-bold text-primary">
                          Level {currentUserPosition.rank} – {TIER_LABELS[selectedTier]} League
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {currentUserPosition.xp_earned} XP this week
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <p className="text-xs font-medium text-muted-foreground mb-2">League Rules</p>
              <div className="grid gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-green-500">📈</span>
                  <span className="text-muted-foreground">Top 10 users are <span className="text-green-500 font-medium">promoted</span> weekly</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-red-500">📉</span>
                  <span className="text-muted-foreground">Bottom 5 users are <span className="text-red-500 font-medium">demoted</span> weekly</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-amber-500">🏆</span>
                  <span className="text-muted-foreground">Top 10 receive <span className="text-amber-500 font-medium">exclusive badges</span> at week end</span>
                </div>
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </Card>
  );
};
