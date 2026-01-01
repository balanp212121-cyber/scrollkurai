import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Medal, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LeaderboardEntry {
  id: string;
  username: string | null;
  xp: number;
  level: number;
  streak: number;
  archetype: string;
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

export const Leaderboard = () => {
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [avatars, setAvatars] = useState<Record<string, UserAvatar>>({});
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userRank, setUserRank] = useState<number | null>(null); // For users outside top 50

  useEffect(() => {
    fetchLeaderboard();
    getCurrentUser();
  }, []);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const fetchLeaderboard = async () => {
    try {
      const { data, error } = await supabase
        .rpc("get_public_profiles", {
          order_by: "xp",
          limit_count: 50
        });

      if (error) {
        console.error("Error fetching leaderboard:", error);
        return;
      }

      setLeaders(data as LeaderboardEntry[]);

      // Check if current user is in top 50
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const userInTop50 = (data as LeaderboardEntry[]).some(l => l.id === user.id);
        if (!userInTop50) {
          // Fetch user's actual rank
          const { data: rankData } = await (supabase.rpc as any)('get_user_global_rank', { p_user_id: user.id });
          if (rankData) {
            setUserRank(rankData);
          }
        }
      }

      // Fetch avatars for all leaders
      if (data && data.length > 0) {
        const userIds = data.map((l: LeaderboardEntry) => l.id);
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
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const getAvatarDisplay = (userId: string, username: string | null) => {
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

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="w-6 h-6 text-yellow-500" />;
      case 1:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 2:
        return <Award className="w-6 h-6 text-amber-600" />;
      default:
        return <span className="w-6 text-center font-bold text-muted-foreground">#{index + 1}</span>;
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-1/3" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-primary/20">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Trophy className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">Leaderboard</h2>
        </div>
        <div className="text-sm text-muted-foreground">
          Top 50 Warriors
        </div>
      </div>

      {/* User's rank if outside top 50 */}
      {userRank && userRank > 50 && (
        <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/30 text-center">
          <p className="text-sm font-medium">
            🏆 You are ranked <span className="text-primary font-bold">#{userRank}</span> globally
          </p>
          <p className="text-xs text-muted-foreground">Complete more quests to climb the leaderboard!</p>
        </div>
      )}

      <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
        {leaders.map((leader, index) => (
          <div
            key={leader.id}
            className={`flex items-center gap-4 p-4 rounded-lg transition-all border ${leader.id === currentUserId
              ? "bg-primary/20 border-primary"
              : index < 3
                ? "bg-green-500/10 border-green-500/30 hover:bg-green-500/20"
                : index >= leaders.length - 3 && leaders.length > 5
                  ? "bg-red-500/10 border-red-500/30 hover:bg-red-500/20"
                  : "bg-muted/50 border-transparent hover:bg-muted"
              }`}
          >
            <div className="flex-shrink-0 w-8 flex items-center justify-center">
              {getRankIcon(index)}
            </div>

            <Avatar
              className="h-10 w-10"
              style={getAvatarBorderStyle(leader.id)}
            >
              <AvatarFallback className="bg-primary/20 text-primary font-bold text-lg">
                {getAvatarDisplay(leader.id, leader.username)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {leader.username || "Anonymous"}
                {leader.id === currentUserId && (
                  <span className="ml-2 text-xs text-primary">(You)</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {leader.archetype}
              </p>
            </div>

            <div className="text-right flex-shrink-0">
              <p className="font-bold text-primary">{leader.xp} XP</p>
              <div className="flex flex-col items-end">
                <p className="text-xs text-muted-foreground">
                  Lv. {leader.level} • {leader.streak}🔥
                </p>
                {index < 3 && (
                  <span className="text-[10px] font-bold text-green-500 uppercase tracking-wider">Promoted</span>
                )}
                {index >= leaders.length - 3 && leaders.length > 5 && (
                  <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Relegated</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {leaders.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          No warriors yet. Be the first!
        </p>
      )}
    </Card>
  );
};
