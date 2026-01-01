import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Crown, UserPlus, LogOut, BarChart3, RefreshCw, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TeamInviteDialog } from "./TeamInviteDialog";
import { TeamStatsCard } from "./TeamStatsCard";
import { useQueryClient } from "@tanstack/react-query";

interface TeamMember {
  user_id: string;
  username: string;
  level: number;
  role: string;
  is_premium: boolean;
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

interface Team {
  id: string;
  name: string;
  description: string | null;
  max_members: number;
  member_count: number;
  is_creator: boolean;
  members: TeamMember[];
}

export function TeamsList() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [leavingTeam, setLeavingTeam] = useState<string | null>(null);
  const [viewingStatsTeam, setViewingStatsTeam] = useState<Team | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<string | null>(null);
  const [avatars, setAvatars] = useState<Record<string, UserAvatar>>({});
  const queryClient = useQueryClient();

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

  useEffect(() => {
    fetchTeams();

    // Set up real-time subscription for team_members changes
    const channel = supabase
      .channel('team-members-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_members'
        },
        (payload) => {
          console.log('[Real-time] Team members changed:', payload);
          fetchTeams();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTeams = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: teamMembers, error: teamMembersError } = await supabase
        .from('team_members')
        .select(`
          team_id,
          role,
          teams!inner (
            id,
            name,
            description,
            max_members,
            creator_id
          )
        `)
        .eq('user_id', user.id);

      if (teamMembersError) {
        console.error('Error fetching team members:', teamMembersError);
        throw teamMembersError;
      }

      if (teamMembers && teamMembers.length > 0) {
        const teamsData = await Promise.all(
          teamMembers.map(async (tm: any) => {
            // Check if teams data exists
            if (!tm.teams) {
              console.error('Team data missing for team_id:', tm.team_id);
              return null;
            }
            const { count } = await supabase
              .from('team_members')
              .select('*', { count: 'exact', head: true })
              .eq('team_id', tm.team_id);

            // Fetch all team members with their profiles using security definer function
            const { data: memberProfiles } = await supabase
              .rpc('get_team_member_profiles', { team_id_param: tm.team_id });

            // Get member roles separately
            const { data: memberRoles } = await supabase
              .from('team_members')
              .select('user_id, role')
              .eq('team_id', tm.team_id);

            const rolesMap = new Map((memberRoles || []).map((m: any) => [m.user_id, m.role]));

            const membersList: TeamMember[] = (memberProfiles || []).map((m: any) => ({
              user_id: m.user_id,
              username: m.username || 'Unknown',
              level: m.level || 1,
              role: rolesMap.get(m.user_id) || 'member',
              is_premium: m.premium_status || false
            }));

            return {
              id: tm.teams.id,
              name: tm.teams.name,
              description: tm.teams.description,
              max_members: tm.teams.max_members,
              member_count: count || 0,
              is_creator: tm.teams.creator_id === user.id,
              members: membersList
            };
          })
        );
        // Filter out any null entries
        const validTeams = teamsData.filter((team): team is Team => team !== null);
        setTeams(validTeams);

        // Fetch avatars for all team members
        const allMemberIds = validTeams.flatMap(team => team.members.map(m => m.user_id));
        if (allMemberIds.length > 0) {
          const { data: avatarData } = await supabase
            .from("user_avatars")
            .select("user_id, avatar_preset, border_color")
            .in("user_id", allMemberIds);

          if (avatarData) {
            const avatarMap: Record<string, UserAvatar> = {};
            avatarData.forEach((a) => {
              avatarMap[a.user_id] = a;
            });
            setAvatars(avatarMap);
          }
        }

        console.log('Teams loaded:', validTeams.length);
      } else {
        setTeams([]);
        console.log('No teams found for user');
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
      toast.error('Failed to load teams');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    fetchTeams(true);
    queryClient.invalidateQueries({ queryKey: ["team-invites"] });
    toast.success('Teams refreshed');
  };

  const handleOpenInviteDialog = (team: Team) => {
    setSelectedTeam(team);
    setInviteDialogOpen(true);
  };

  const handleLeaveTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Are you sure you want to leave "${teamName}"?`)) return;

    setLeavingTeam(teamId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success(`You left "${teamName}"`);
      fetchTeams();
    } catch (error) {
      console.error('Error leaving team:', error);
      toast.error('Failed to leave team');
    } finally {
      setLeavingTeam(null);
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Are you sure you want to delete "${teamName}"? This action cannot be undone.`)) return;

    setDeletingTeam(teamId);
    try {
      // First delete all team members
      const { error: membersError } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId);

      if (membersError) throw membersError;

      // Then delete the team
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);

      if (error) throw error;

      toast.success(`Team "${teamName}" has been deleted`);
      fetchTeams();
    } catch (error) {
      console.error('Error deleting team:', error);
      toast.error('Failed to delete team');
    } finally {
      setDeletingTeam(null);
    }
  };

  if (loading) {
    return <div className="text-center text-muted-foreground">Loading teams...</div>;
  }

  if (teams.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">
          You're not part of any teams yet. Create one to get started!
        </p>
      </Card>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{teams.length} team{teams.length > 1 ? 's' : ''}</p>
        <Button
          size="sm"
          variant="outline"
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4">
        {teams.map((team) => (
          <Card key={team.id} className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold">{team.name}</h3>
                  {team.is_creator && (
                    <Badge className="bg-gold text-gold-foreground border-gold/50">
                      <Crown className="w-3 h-3 mr-1" />
                      Creator
                    </Badge>
                  )}
                </div>
                {team.description && (
                  <p className="text-sm text-muted-foreground">{team.description}</p>
                )}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>{team.member_count} / {team.max_members} members</span>
                  </div>
                  
                  {/* Team Members List */}
                  <div className="flex flex-wrap gap-2">
                    {team.members.map((member) => (
                      <Badge
                        key={member.user_id}
                        variant="outline"
                        className="gap-1.5 py-1 px-2"
                      >
                        <div className={`relative ${member.is_premium ? 'animate-pulse' : ''}`}>
                          <Avatar 
                            className={`h-5 w-5 ${member.is_premium ? 'ring-2 ring-accent ring-offset-1 ring-offset-background' : ''}`}
                            style={getAvatarBorderStyle(member.user_id)}
                          >
                            <AvatarFallback className={`text-[10px] ${member.is_premium ? 'bg-accent/30 text-accent' : 'bg-primary/20 text-primary'}`}>
                              {getAvatarDisplay(member.user_id, member.username)}
                            </AvatarFallback>
                          </Avatar>
                          {member.is_premium && (
                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-accent rounded-full animate-ping opacity-75" />
                          )}
                        </div>
                        {member.role === 'creator' && <Crown className="w-3 h-3 text-gold" />}
                        {member.is_premium && <span className="text-[10px] text-accent">PRO</span>}
                        {member.username} • Lv{member.level}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 mt-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setViewingStatsTeam(team)}
                className="gap-1"
              >
                <BarChart3 className="w-4 h-4" />
                View Stats
              </Button>
              {team.is_creator && team.member_count < team.max_members && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenInviteDialog(team)}
                  className="gap-1"
                >
                  <UserPlus className="w-4 h-4" />
                  Invite Members
                </Button>
              )}
              {team.is_creator && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDeleteTeam(team.id, team.name)}
                  disabled={deletingTeam === team.id}
                  className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                  {deletingTeam === team.id ? 'Deleting...' : 'Delete Team'}
                </Button>
              )}
              {!team.is_creator && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleLeaveTeam(team.id, team.name)}
                  disabled={leavingTeam === team.id}
                  className="gap-1 text-destructive border-destructive/30"
                >
                  <LogOut className="w-4 h-4" />
                  {leavingTeam === team.id ? 'Leaving...' : 'Leave Team'}
                </Button>
              )}
            </div>
            
            {viewingStatsTeam?.id === team.id && (
              <div className="mt-6 pt-6 border-t">
                <TeamStatsCard teamId={team.id} teamName={team.name} />
              </div>
            )}
          </Card>
        ))}
      </div>

      {selectedTeam && (
        <TeamInviteDialog
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
          teamId={selectedTeam.id}
          teamName={selectedTeam.name}
          currentMemberCount={selectedTeam.member_count}
          maxMembers={selectedTeam.max_members}
        />
      )}
    </>
  );
}