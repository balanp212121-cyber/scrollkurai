import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, Trophy, Target, Clock, Plus, RefreshCw, Pencil, Trash2, Gift, Eye } from "lucide-react";
import { toast } from "sonner";
import { differenceInDays } from "date-fns";
import { CreateChallengeDialog } from "@/components/Challenges/CreateChallengeDialog";
import { EditChallengeDialog } from "@/components/Challenges/EditChallengeDialog";
import { DeleteChallengeDialog } from "@/components/Challenges/DeleteChallengeDialog";
import { ChallengeCompletionModal } from "@/components/Challenges/ChallengeCompletionModal";
import { ViewParticipantsModal } from "@/components/Challenges/ViewParticipantsModal";
import { TeamChallengesList } from "@/components/Teams/TeamChallengesList";
import { TeamSelectionDialog } from "@/components/Teams/TeamSelectionDialog";
import { DuoPartnerSelectionDialog } from "@/components/Challenges/DuoPartnerSelectionDialog";
import { Separator } from "@/components/ui/separator";
import { useAdminCheck } from "@/hooks/useAdminCheck";

interface Team {
  id: string;
  name: string;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  challenge_type: "solo" | "duo" | "team";
  target_type: string;
  target_value: number;
  duration_days: number;
  starts_at: string;
  ends_at: string;
  is_public: boolean;
  creator_id: string;
  participant_count?: number;
  user_progress?: number;
  user_joined?: boolean;
  reward_xp?: number;
  reward_badge_id?: string | null;
  reward_badge?: { name: string; icon: string } | null;
}

interface CompletionReward {
  challengeTitle: string;
  xpAwarded?: number;
  badgeAwarded?: { name: string; icon: string } | null;
}

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [completionReward, setCompletionReward] = useState<CompletionReward | null>(null);
  const [viewParticipantsOpen, setViewParticipantsOpen] = useState(false);
  const [viewingChallenge, setViewingChallenge] = useState<Challenge | null>(null);
  const [teamSelectionOpen, setTeamSelectionOpen] = useState(false);
  const [duoSelectionOpen, setDuoSelectionOpen] = useState(false);
  const [userTeams, setUserTeams] = useState<Team[]>([]);
  const [pendingChallengeId, setPendingChallengeId] = useState<string | null>(null);
  const [pendingChallengeTitle, setPendingChallengeTitle] = useState<string>("");
  const { data: isAdmin } = useAdminCheck();

  useEffect(() => {
    fetchChallenges();
  }, []);

  const fetchChallenges = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Build query - team/duo challenges must be approved (unless admin)
      let query = (supabase as any)
        .from('challenges')
        .select('*, badges:reward_badge_id(name, icon)')
        .eq('is_public', true)
        .gte('ends_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      // For non-admins, filter out unapproved team/duo challenges
      // Solo challenges are auto-approved so they pass through
      if (!isAdmin) {
        query = query.or('approval_status.eq.approved,challenge_type.eq.solo');
      }

      const { data: challengesData, error } = await query;

      if (error) throw error;

      const challengesWithData = await Promise.all(
        challengesData.map(async (challenge: Challenge) => {
          const { count } = await (supabase as any)
            .from('challenge_participants')
            .select('*', { count: 'exact', head: true })
            .eq('challenge_id', challenge.id);

          let userProgress = 0;
          let userJoined = false;

          if (user) {
            const { data: participantData } = await (supabase as any)
              .from('challenge_participants')
              .select('current_progress')
              .eq('challenge_id', challenge.id)
              .eq('user_id', user.id)
              .maybeSingle();

            if (participantData) {
              userProgress = participantData.current_progress;
              userJoined = true;
            }
          }

          return {
            ...challenge,
            participant_count: count || 0,
            user_progress: userProgress,
            user_joined: userJoined,
            reward_badge: (challenge as any).badges || null,
          };
        })
      );

      setChallenges(challengesWithData);
    } catch (error) {
      console.error('Error fetching challenges:', error);
      toast.error('Failed to load challenges');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinChallenge = async (challengeId: string, challengeType: string, challengeTitle: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please sign in to join challenges');
        return;
      }

      // Handle Duo Challenges
      if (challengeType === 'duo') {
        setPendingChallengeId(challengeId);
        setPendingChallengeTitle(challengeTitle);
        setDuoSelectionOpen(true);
        return;
      }

      // For team challenges, only team creators can join
      if (challengeType === 'team') {
        const { data: teams } = await supabase
          .from('teams')
          .select('id, name')
          .eq('creator_id', user.id);

        if (!teams || teams.length === 0) {
          toast.error(`Only team creators can join team challenges. Create a team first!`);
          return;
        }

        // If user has multiple teams, show selection dialog
        if (teams.length > 1) {
          setUserTeams(teams);
          setPendingChallengeId(challengeId);
          setPendingChallengeTitle(challengeTitle);
          setTeamSelectionOpen(true);
          return;
        }

        // Single team - auto join
        // For consistency, we'll ask them to use the Team Challenges tab if they want specific features,
        // but for now let's allow it if we have a robust way, or redirect.
        // Given existing flow was a bit mixed, let's keep it simple:
        toast.info("Please join via the Team Challenges list below for full features");
        return;
      }

      // Get current profile stats for baseline
      const { data: profile } = await supabase
        .from('profiles')
        .select('total_quests_completed, xp, streak')
        .eq('id', user.id)
        .single();

      const { error } = await (supabase as any)
        .from('challenge_participants')
        .insert({
          challenge_id: challengeId,
          user_id: user.id,
          baseline_quests: profile?.total_quests_completed || 0,
          baseline_xp: profile?.xp || 0,
          baseline_streak: profile?.streak || 0,
        });

      if (error) throw error;

      toast.success('Joined challenge! Good luck! 🚀');
      fetchChallenges();
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('You already joined this challenge');
      } else {
        toast.error('Failed to join challenge');
      }
    }
  };

  const handleDuoPartnerSelected = async (partnerId: string) => {
    if (!pendingChallengeId) return;

    try {
      const { data, error } = await supabase.functions.invoke('join-duo-challenge', {
        body: {
          challenge_id: pendingChallengeId,
          partner_id: partnerId
        }
      });

      if (error) {
        throw error;
      }

      if (data && data.error) {
        throw new Error(data.error);
      }

      toast.success(data?.message || "Joined Duo Challenge successfully!");
      fetchChallenges();
    } catch (error) {
      console.error('Error joining duo challenge:', error);
      toast.error(error instanceof Error ? error.message : "Failed to join duo challenge");
    } finally {
      setDuoSelectionOpen(false);
      setPendingChallengeId(null);
      setPendingChallengeTitle("");
    }
  };

  const handleTeamSelected = async (team: Team) => {
    if (!pendingChallengeId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get current profile stats for baseline
      const { data: profile } = await supabase
        .from('profiles')
        .select('total_quests_completed, xp, streak')
        .eq('id', user.id)
        .single();

      const { error } = await (supabase as any)
        .from('challenge_participants')
        .insert({
          challenge_id: pendingChallengeId,
          user_id: user.id,
          baseline_quests: profile?.total_quests_completed || 0,
          baseline_xp: profile?.xp || 0,
          baseline_streak: profile?.streak || 0,
        });

      if (error) throw error;

      toast.success(`Joined challenge with team "${team.name}"! Good luck! 🚀`);
      fetchChallenges();
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('You already joined this challenge');
      } else {
        toast.error('Failed to join challenge');
      }
    } finally {
      setPendingChallengeId(null);
      setPendingChallengeTitle("");
    }
  };

  const handleSyncProgress = async () => {
    setSyncing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please sign in to sync progress');
        return;
      }

      const { data, error } = await supabase.functions.invoke('update-challenge-progress');

      if (error) throw error;

      // Check if any challenges were completed with rewards
      if (data?.rewards && data.rewards.length > 0) {
        const reward = data.rewards[0];
        // Find the challenge title
        const completedChallenge = challenges.find(c => c.id === reward.challenge_id);

        setCompletionReward({
          challengeTitle: completedChallenge?.title || 'Challenge',
          xpAwarded: reward.xp_awarded,
          badgeAwarded: reward.badge_awarded ? {
            name: reward.badge_name || 'Badge',
            icon: reward.badge_icon || '🏆',
          } : null,
        });
        setCompletionModalOpen(true);
      } else {
        toast.success('Challenge progress synced! 🎯');
      }

      fetchChallenges();
    } catch (error) {
      console.error('Error syncing progress:', error);
      toast.error('Failed to sync progress');
    } finally {
      setSyncing(false);
    }
  };

  const getTargetTypeIcon = (type: string) => {
    switch (type) {
      case 'quests':
        return <Target className="w-4 h-4" />;
      case 'xp':
        return <Trophy className="w-4 h-4" />;
      case 'streak':
        return <Clock className="w-4 h-4" />;
      default:
        return <Target className="w-4 h-4" />;
    }
  };

  const handleEditChallenge = (challenge: Challenge) => {
    setSelectedChallenge(challenge);
    setEditDialogOpen(true);
  };

  const handleDeleteChallenge = (challenge: Challenge) => {
    setSelectedChallenge(challenge);
    setDeleteDialogOpen(true);
  };

  const handleViewParticipants = (challenge: Challenge) => {
    setViewingChallenge(challenge);
    setViewParticipantsOpen(true);
  };

  const renderChallenge = (challenge: Challenge) => {
    const daysLeft = differenceInDays(new Date(challenge.ends_at), new Date());
    const progressPercentage = (challenge.user_progress || 0) / challenge.target_value * 100;

    return (
      <Card key={challenge.id} className="p-4 bg-card/50 border-primary/20">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg">{challenge.title}</h3>
                <Badge variant="outline" className="text-xs">
                  {challenge.challenge_type.toUpperCase()}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{challenge.description}</p>
            </div>
            <div className="flex items-center gap-1">
              {challenge.user_joined && (
                <Badge className="bg-primary/20 text-primary border-primary/30">
                  Joined
                </Badge>
              )}
              {isAdmin && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-blue-500"
                    onClick={() => handleViewParticipants(challenge)}
                    title="View Participants"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={() => handleEditChallenge(challenge)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteChallenge(challenge)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              {getTargetTypeIcon(challenge.target_type)}
              <div>
                <p className="text-xs text-muted-foreground">Target</p>
                <p className="text-sm font-medium">
                  {challenge.target_value} {challenge.target_type}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <div>
                <p className="text-xs text-muted-foreground">Participants</p>
                <p className="text-sm font-medium">{challenge.participant_count}</p>
              </div>
            </div>
          </div>

          {/* Rewards Display */}
          {(challenge.reward_xp && challenge.reward_xp > 0) || challenge.reward_badge ? (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Gift className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-amber-500 font-medium">Rewards:</span>
              {challenge.reward_xp && challenge.reward_xp > 0 && (
                <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-500">
                  +{challenge.reward_xp} XP
                </Badge>
              )}
              {challenge.reward_badge && (
                <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-500">
                  <span className="mr-1">{challenge.reward_badge.icon}</span>
                  {challenge.reward_badge.name}
                </Badge>
              )}
            </div>
          ) : null}

          {challenge.user_joined && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Your Progress</span>
                <span className="font-medium">
                  {challenge.user_progress} / {challenge.target_value}
                </span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              {daysLeft > 0 ? `${daysLeft} days left` : 'Ending soon'}
            </p>
            {!challenge.user_joined && (
              <Button
                onClick={() => handleJoinChallenge(challenge.id, challenge.challenge_type, challenge.title)}
                size="sm"
                className="bg-primary/20 hover:bg-primary/30"
              >
                Join Challenge
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex gap-3">
        {isAdmin && (
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="bg-gradient-to-r from-primary to-accent flex-1"
            size="lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Challenge
          </Button>
        )}
        <Button
          onClick={handleSyncProgress}
          disabled={syncing}
          variant="outline"
          size="lg"
          className={isAdmin ? "border-primary/20" : "border-primary/20 flex-1"}
        >
          <RefreshCw className={`w-5 h-5 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Progress'}
        </Button>
      </div>
      <CreateChallengeDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onChallengeCreated={fetchChallenges}
      />

      <EditChallengeDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        challenge={selectedChallenge}
        onChallengeUpdated={fetchChallenges}
      />

      <DeleteChallengeDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        challengeId={selectedChallenge?.id || null}
        challengeTitle={selectedChallenge?.title || ""}
        onChallengeDeleted={fetchChallenges}
      />

      <ViewParticipantsModal
        open={viewParticipantsOpen}
        onOpenChange={setViewParticipantsOpen}
        challengeId={viewingChallenge?.id || null}
        challengeTitle={viewingChallenge?.title || ""}
        targetValue={viewingChallenge?.target_value || 0}
        targetType={viewingChallenge?.target_type || "quests"}
        isAdmin={isAdmin}
      />

      <ChallengeCompletionModal
        open={completionModalOpen}
        onOpenChange={setCompletionModalOpen}
        challengeTitle={completionReward?.challengeTitle || ''}
        xpAwarded={completionReward?.xpAwarded}
        badgeAwarded={completionReward?.badgeAwarded}
      />

      <TeamSelectionDialog
        open={teamSelectionOpen}
        onOpenChange={setTeamSelectionOpen}
        teams={userTeams}
        onTeamSelected={handleTeamSelected}
        challengeTitle={pendingChallengeTitle}
      />

      <DuoPartnerSelectionDialog
        open={duoSelectionOpen}
        onOpenChange={setDuoSelectionOpen}
        challengeTitle={pendingChallengeTitle}
        onPartnerSelected={handleDuoPartnerSelected}
      />

      {/* Solo Challenges */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Target className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">Solo Challenges</h2>
            <p className="text-sm text-muted-foreground">Individual challenges</p>
          </div>
        </div>

        {loading ? (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">Loading...</p>
          </Card>
        ) : challenges.filter(c => c.challenge_type === 'solo').length === 0 ? (
          <Card className="p-6 text-center">
            <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No active solo challenges</p>
          </Card>
        ) : (
          challenges.filter(c => c.challenge_type === 'solo').map(challenge => renderChallenge(challenge))
        )}
      </div>

      <Separator className="my-8" />

      {/* Duo Challenges */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-6 h-6 text-accent" />
          <div>
            <h2 className="text-2xl font-bold">Duo Challenges</h2>
            <p className="text-sm text-muted-foreground">2-person challenges</p>
          </div>
        </div>

        {loading ? (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">Loading...</p>
          </Card>
        ) : challenges.filter(c => c.challenge_type === 'duo').length === 0 ? (
          <Card className="p-6 text-center">
            <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No active duo challenges</p>
          </Card>
        ) : (
          challenges.filter(c => c.challenge_type === 'duo').map(challenge => renderChallenge(challenge))
        )}
      </div>

      <Separator className="my-8" />

      {/* Team Challenges */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">Team Challenges</h2>
            <p className="text-sm text-muted-foreground">Compete together with your team</p>
          </div>
        </div>

        <TeamChallengesList />
      </div>
    </div>
  );
}