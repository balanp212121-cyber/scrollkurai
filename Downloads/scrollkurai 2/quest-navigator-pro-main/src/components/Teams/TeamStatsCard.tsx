import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Target, Zap, Award, TrendingUp, Users, Flame, Crown, Star, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface TeamMember {
  user_id: string;
  username: string;
  xp: number;
  level: number;
  streak: number;
  archetype: string;
  total_quests_completed: number;
  is_premium: boolean;
  avatar_preset: string | null;
  border_color: string | null;
}

interface TeamStats {
  totalXp: number;
  totalQuests: number;
  totalStreak: number;
  avgLevel: number;
  activeChallenges: number;
  completedChallenges: number;
  members: TeamMember[];
}

interface TeamStatsCardProps {
  teamId: string;
  teamName: string;
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

const ARCHETYPE_ICONS: Record<string, string> = {
  minimalist: "🧘",
  achiever: "🏆",
  explorer: "🧭",
  socializer: "🤝",
  default: "✨",
};

export function TeamStatsCard({ teamId, teamName }: TeamStatsCardProps) {
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeamStats();
  }, [teamId]);

  const getAvatarDisplay = (member: TeamMember) => {
    if (member.avatar_preset && AVATAR_PRESETS[member.avatar_preset]) {
      return AVATAR_PRESETS[member.avatar_preset];
    }
    return member.username?.charAt(0).toUpperCase() || "?";
  };

  const getArchetypeIcon = (archetype: string | null | undefined) => {
    if (!archetype) return ARCHETYPE_ICONS.default;
    return ARCHETYPE_ICONS[archetype.toLowerCase()] || ARCHETYPE_ICONS.default;
  };

  const fetchTeamStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Get team members with full profile data using security definer function
      const { data: memberProfiles, error: profilesError } = await supabase
        .rpc('get_team_member_profiles', { team_id_param: teamId });

      if (profilesError) {
        console.error('Error fetching member profiles:', profilesError);
        setStats({
          totalXp: 0,
          totalQuests: 0,
          totalStreak: 0,
          avgLevel: 0,
          activeChallenges: 0,
          completedChallenges: 0,
          members: []
        });
        setLoading(false);
        return;
      }

      if (!memberProfiles || memberProfiles.length === 0) {
        setStats({
          totalXp: 0,
          totalQuests: 0,
          totalStreak: 0,
          avgLevel: 0,
          activeChallenges: 0,
          completedChallenges: 0,
          members: []
        });
        setLoading(false);
        return;
      }

      const memberIds = memberProfiles.map((m: any) => m.user_id);

      // Get avatars
      const { data: avatars } = await supabase
        .from('user_avatars')
        .select('user_id, avatar_preset, border_color')
        .in('user_id', memberIds);

      const avatarMap = new Map((avatars || []).map(a => [a.user_id, a]));

      // Get team challenge progress
      const { data: challenges } = await supabase
        .from('team_challenge_progress')
        .select('*, team_challenges(target_value, target_type)')
        .eq('team_id', teamId);

      const activeChallenges = challenges?.filter(c => !c.completed).length || 0;
      const completedChallenges = challenges?.filter(c => c.completed).length || 0;

      const members: TeamMember[] = memberProfiles.map((p: any) => {
        const avatar = avatarMap.get(p.user_id);
        return {
          user_id: p.user_id,
          username: p.username || 'Anonymous',
          xp: p.xp || 0,
          level: p.level || 1,
          streak: p.streak || 0,
          archetype: p.archetype || 'default',
          total_quests_completed: p.total_quests_completed || 0,
          is_premium: p.premium_status || false,
          avatar_preset: avatar?.avatar_preset || null,
          border_color: avatar?.border_color || null
        };
      });

      const totalXp = members.reduce((sum, m) => sum + m.xp, 0);
      const totalQuests = members.reduce((sum, m) => sum + m.total_quests_completed, 0);
      const totalStreak = members.reduce((sum, m) => sum + m.streak, 0);
      const avgLevel = members.length > 0 ? Math.round(members.reduce((sum, m) => sum + m.level, 0) / members.length) : 0;

      // Sort members by XP
      members.sort((a, b) => b.xp - a.xp);

      setStats({
        totalXp,
        totalQuests,
        totalStreak,
        avgLevel,
        activeChallenges,
        completedChallenges,
        members
      });
    } catch (error) {
      console.error('Error fetching team stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">Loading team stats...</div>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Team Overview */}
      <Card className="p-6 bg-gradient-to-br from-primary/10 to-accent/10">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-6 h-6 text-gold" />
          <h3 className="text-xl font-bold">{teamName} Statistics</h3>
        </div>
        
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Zap className="w-4 h-4" />
              <span>Total XP</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalXp.toLocaleString()}</p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Target className="w-4 h-4" />
              <span>Quests</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalQuests}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Flame className="w-4 h-4 text-orange-500" />
              <span>Streaks</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalStreak}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Star className="w-4 h-4 text-yellow-500" />
              <span>Avg Level</span>
            </div>
            <p className="text-2xl font-bold">{stats.avgLevel}</p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <TrendingUp className="w-4 h-4" />
              <span>Active</span>
            </div>
            <p className="text-2xl font-bold">{stats.activeChallenges}</p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Award className="w-4 h-4" />
              <span>Completed</span>
            </div>
            <p className="text-2xl font-bold">{stats.completedChallenges}</p>
          </div>
        </div>
      </Card>

      {/* Member Details */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold">Team Members ({stats.members.length})</h3>
        </div>

        {stats.members.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No members yet</p>
        ) : (
          <div className="space-y-4">
            {stats.members.map((member, index) => {
              const contributionPercent = stats.totalXp > 0 
                ? (member.xp / stats.totalXp) * 100 
                : 0;
              
              return (
                <Card 
                  key={member.user_id} 
                  className={`p-4 ${member.is_premium ? 'bg-gradient-to-r from-accent/10 to-primary/10 border-accent/30' : 'bg-card/50'}`}
                >
                  <div className="flex items-center gap-4">
                    {/* Rank & Avatar */}
                    <div className="flex items-center gap-3">
                      <Badge 
                        className={`w-8 h-8 flex items-center justify-center ${
                          index === 0 ? "bg-gold text-gold-foreground border-gold/50" :
                          index === 1 ? "bg-slate-300 text-slate-900 border-slate-400" :
                          index === 2 ? "bg-amber-600 text-white border-amber-700" :
                          "bg-muted"
                        }`}
                      >
                        #{index + 1}
                      </Badge>
                      <div className="relative">
                        <Avatar 
                          className={`h-12 w-12 ${member.is_premium ? 'ring-2 ring-accent ring-offset-2 ring-offset-background' : ''}`}
                          style={member.border_color ? { borderColor: member.border_color, borderWidth: "2px" } : {}}
                        >
                          <AvatarFallback className={`text-lg ${member.is_premium ? 'bg-accent/30 text-accent' : 'bg-primary/20 text-primary'}`}>
                            {getAvatarDisplay(member)}
                          </AvatarFallback>
                        </Avatar>
                        {member.is_premium && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-accent rounded-full flex items-center justify-center">
                            <Crown className="w-3 h-3 text-accent-foreground" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Member Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-lg truncate">{member.username}</p>
                        {member.is_premium && (
                          <Badge className="bg-accent/20 text-accent text-xs">
                            <Sparkles className="w-3 h-3 mr-1" />
                            PRO
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3" /> Lv {member.level}
                        </span>
                        <span className="flex items-center gap-1">
                          <Flame className="w-3 h-3 text-orange-500" /> {member.streak} day streak
                        </span>
                        <span className="flex items-center gap-1">
                          <Target className="w-3 h-3" /> {member.total_quests_completed} quests
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {getArchetypeIcon(member.archetype)} {member.archetype}
                        </Badge>
                      </div>
                    </div>

                    {/* XP Stats */}
                    <div className="text-right shrink-0">
                      <p className="font-bold text-xl text-primary">{member.xp.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">XP</p>
                    </div>
                  </div>

                  {/* Contribution Bar */}
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Team Contribution</span>
                      <span>{contributionPercent.toFixed(1)}%</span>
                    </div>
                    <Progress value={contributionPercent} className="h-2" />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
