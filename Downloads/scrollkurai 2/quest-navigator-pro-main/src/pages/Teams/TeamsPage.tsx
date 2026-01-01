import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Trophy, Target, Plus, UserPlus, Check, X, Zap, UsersRound, Swords } from "lucide-react";
import { CreateTeamDialog } from "@/components/Teams/CreateTeamDialog";
import { TeamsList } from "@/components/Teams/TeamsList";
import { TeamChallengesList } from "@/components/Teams/TeamChallengesList";
import { TeamInvitesList } from "@/components/Teams/TeamInvitesList";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Friend {
  id: string;
  status: string;
  created_at: string;
  friend_profile?: {
    id: string;
    username: string;
    level: number;
    xp: number;
    streak: number;
  };
}

interface TeamStats {
  totalTeams: number;
  totalMembers: number;
  activeChallenges: number;
}

export default function TeamsPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([]);
  const [sentRequests, setSentRequests] = useState<Friend[]>([]);
  const [searchUsername, setSearchUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [teamStats, setTeamStats] = useState<TeamStats>({ totalTeams: 0, totalMembers: 0, activeChallenges: 0 });
  const queryClient = useQueryClient();
  const teamsListKey = useRef(0);

  useEffect(() => {
    fetchFriends();
    fetchTeamStats();
  }, []);

  const fetchTeamStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user's teams
      const { data: userTeams } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id);

      const teamIds = userTeams?.map(t => t.team_id) || [];
      
      if (teamIds.length === 0) {
        setTeamStats({ totalTeams: 0, totalMembers: 0, activeChallenges: 0 });
        return;
      }

      // Count total members across all teams
      const { count: membersCount } = await supabase
        .from('team_members')
        .select('*', { count: 'exact', head: true })
        .in('team_id', teamIds);

      // Count active challenges for user's teams
      const now = new Date().toISOString();
      const { count: challengesCount } = await supabase
        .from('team_challenge_progress')
        .select('*', { count: 'exact', head: true })
        .in('team_id', teamIds)
        .eq('completed', false);

      setTeamStats({
        totalTeams: teamIds.length,
        totalMembers: membersCount || 0,
        activeChallenges: challengesCount || 0
      });
    } catch (error) {
      console.error('Error fetching team stats:', error);
    }
  };

  // Real-time subscription for team invite acceptances
  useEffect(() => {
    const setupInviteNotifications = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel('team-invite-acceptances')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'team_invites',
            filter: `inviter_id=eq.${user.id}`
          },
          async (payload) => {
            console.log('[Real-time] Team invite updated:', payload);
            
            if (payload.new.status === 'accepted' && payload.old.status === 'pending') {
              // Fetch team and user details for notification
              const { data: teamData } = await supabase
                .from('teams')
                .select('name')
                .eq('id', payload.new.team_id)
                .single();

              const { data: inviteeProfile } = await supabase
                .from('profiles')
                .select('username')
                .eq('id', payload.new.invitee_id)
                .single();

              if (teamData && inviteeProfile) {
                toast.success(
                  `${inviteeProfile.username} accepted your invite to ${teamData.name}!`,
                  {
                    duration: 5000,
                    description: 'Your team just got stronger! 🎉'
                  }
                );
              }

              // Refresh team data
              queryClient.invalidateQueries({ queryKey: ["teams"] });
              queryClient.invalidateQueries({ queryKey: ["team-invites"] });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    setupInviteNotifications();
  }, [queryClient]);

  const handleCreateDialogClose = (open: boolean) => {
    setShowCreateDialog(open);
    if (!open) {
      // Force re-render of TeamsList when dialog closes
      teamsListKey.current += 1;
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    }
  };

  const fetchFriends = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: acceptedFriends } = await supabase
        .from('friends')
        .select('id, status, created_at, friend_id')
        .eq('user_id', user.id)
        .eq('status', 'accepted');

      const { data: pending } = await supabase
        .from('friends')
        .select('id, status, created_at, user_id')
        .eq('friend_id', user.id)
        .eq('status', 'pending');

      const { data: sent } = await supabase
        .from('friends')
        .select('id, status, created_at, friend_id')
        .eq('user_id', user.id)
        .eq('status', 'pending');

      if (acceptedFriends && acceptedFriends.length > 0) {
        const friendIds = acceptedFriends.map(f => f.friend_id);
        const { data: profiles } = await supabase.rpc('get_profiles_by_ids', {
          user_ids: friendIds
        });
        const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);
        setFriends(acceptedFriends.map(f => ({
          ...f,
          friend_profile: profileMap.get(f.friend_id)
        })) || []);
      } else {
        setFriends([]);
      }

      if (pending && pending.length > 0) {
        const userIds = pending.map(p => p.user_id);
        const { data: profiles } = await supabase.rpc('get_profiles_by_ids', {
          user_ids: userIds
        });
        const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);
        setPendingRequests(pending.map(p => ({
          ...p,
          friend_profile: profileMap.get(p.user_id)
        })) || []);
      } else {
        setPendingRequests([]);
      }

      if (sent && sent.length > 0) {
        const friendIds = sent.map(s => s.friend_id);
        const { data: profiles } = await supabase.rpc('get_profiles_by_ids', {
          user_ids: friendIds
        });
        const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);
        setSentRequests(sent.map(s => ({
          ...s,
          friend_profile: profileMap.get(s.friend_id)
        })) || []);
      } else {
        setSentRequests([]);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async () => {
    if (!searchUsername.trim()) {
      toast.error('Enter a username');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: users, error: searchError } = await supabase.rpc('search_users_by_username', {
        search_term: searchUsername.trim()
      });

      if (searchError) throw searchError;

      if (!users || users.length === 0) {
        toast.error('User not found');
        return;
      }

      const targetUser = users[0];

      if (targetUser.id === user.id) {
        toast.error("You can't add yourself");
        return;
      }

      const { error } = await supabase
        .from('friends')
        .insert({
          user_id: user.id,
          friend_id: targetUser.id,
          status: 'pending'
        });

      if (error) throw error;

      toast.success('Friend request sent!');
      setSearchUsername('');
      fetchFriends();
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Request already sent');
      } else {
        toast.error('Failed to send request');
      }
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('friends')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Friend request accepted!');
      fetchFriends();
    } catch (error) {
      toast.error('Failed to accept request');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('friends')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Request rejected');
      fetchFriends();
    } catch (error) {
      toast.error('Failed to reject request');
    }
  };

  return (
    <div className="space-y-6">
      {/* Team Stats Summary Card */}
      <Card className="p-6 bg-gradient-to-br from-emerald-500/20 via-primary/10 to-cyan-500/20 border-emerald-500/30">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <UsersRound className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{teamStats.totalTeams}</p>
              <p className="text-xs text-muted-foreground">Teams</p>
            </div>
          </div>
          <div className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{teamStats.totalMembers}</p>
              <p className="text-xs text-muted-foreground">Members</p>
            </div>
          </div>
          <div className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center">
              <Swords className="w-6 h-6 text-cyan-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{teamStats.activeChallenges}</p>
              <p className="text-xs text-muted-foreground">Active Challenges</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Create Team Button */}
      <div className="flex justify-end">
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Team
        </Button>
      </div>

      {/* Team Challenges Banner */}
      <Card className="p-6 bg-gradient-to-r from-primary/20 to-accent/20 border-primary/30">
        <div className="flex items-center gap-4">
          <Trophy className="w-12 h-12 text-gold" />
          <div>
            <h2 className="text-xl font-bold">Weekly Team Challenges</h2>
            <p className="text-sm text-muted-foreground">
              Join forces with 3-5 friends to tackle weekly challenges and earn exclusive rewards
            </p>
          </div>
        </div>
      </Card>

      {/* Team Invites */}
      <TeamInvitesList />

      {/* My Teams - Now at top */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          My Teams
        </h2>
        <TeamsList key={teamsListKey.current} />
      </div>

      {/* Active Team Challenges */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Active Challenges
          </h2>
          <Badge className="bg-primary/20 text-primary border-primary/30">
            This Week
          </Badge>
        </div>
        <TeamChallengesList />
      </div>

      {/* Friends Section - Now at bottom, similar to Quick Action */}
      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/20">
            <UserPlus className="w-6 h-6 text-cyan-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-500 to-primary bg-clip-text text-transparent">Friends</h2>
            <p className="text-sm text-muted-foreground">Share your journey with friends</p>
          </div>
        </div>

        {/* Add Friend */}
        <Card className="p-4 bg-cyan-500/10 border-cyan-500/30">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-cyan-500" />
              <h3 className="font-semibold">Invite a Friend</h3>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Enter username"
                value={searchUsername}
                onChange={(e) => setSearchUsername(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendRequest()}
              />
              <Button onClick={handleSendRequest} className="bg-cyan-500 hover:bg-cyan-600">
                <UserPlus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Friends Tabs */}
        <Tabs defaultValue="friends" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="friends">
              Friends ({friends.length})
            </TabsTrigger>
            <TabsTrigger value="pending">
              Requests ({pendingRequests.length})
            </TabsTrigger>
            <TabsTrigger value="sent">
              Sent ({sentRequests.length})
            </TabsTrigger>
          </TabsList>

          {/* Friends List */}
          <TabsContent value="friends" className="space-y-3">
            {loading ? (
              <p className="text-center text-muted-foreground">Loading...</p>
            ) : friends.length === 0 ? (
              <p className="text-center text-muted-foreground">No friends yet. Add some!</p>
            ) : (
              friends.map((friend) => (
                <Card key={friend.id} className="p-4 bg-card/50 border-cyan-500/20 hover:border-cyan-500/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-primary flex items-center justify-center text-sm font-bold">
                        {friend.friend_profile?.username?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold">{friend.friend_profile?.username}</h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Lvl {friend.friend_profile?.level}</span>
                          <span className="flex items-center gap-1">
                            <Zap className="w-3 h-3" /> {friend.friend_profile?.xp} XP
                          </span>
                        </div>
                      </div>
                    </div>
                    <Badge className="bg-primary/20 text-primary">
                      🔥 {friend.friend_profile?.streak}
                    </Badge>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Pending Requests */}
          <TabsContent value="pending" className="space-y-3">
            {pendingRequests.length === 0 ? (
              <p className="text-center text-muted-foreground">No pending requests</p>
            ) : (
              pendingRequests.map((request) => (
                <Card key={request.id} className="p-4 bg-card/50 border-cyan-500/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-primary flex items-center justify-center font-bold">
                        {request.friend_profile?.username?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-medium">{request.friend_profile?.username}</h3>
                        <p className="text-xs text-muted-foreground">Lvl {request.friend_profile?.level}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAcceptRequest(request.id)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRejectRequest(request.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Sent Requests */}
          <TabsContent value="sent" className="space-y-3">
            {sentRequests.length === 0 ? (
              <p className="text-center text-muted-foreground">No sent requests</p>
            ) : (
              sentRequests.map((request) => (
                <Card key={request.id} className="p-4 bg-card/50 border-cyan-500/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-primary flex items-center justify-center font-bold">
                        {request.friend_profile?.username?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-medium">{request.friend_profile?.username}</h3>
                        <Badge variant="outline" className="text-xs">Pending</Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </Card>

      <CreateTeamDialog 
        open={showCreateDialog} 
        onOpenChange={handleCreateDialogClose} 
      />
    </div>
  );
}