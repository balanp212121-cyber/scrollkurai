import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Users, Trophy, Target, Clock, MessageCircle } from "lucide-react";
import { differenceInDays } from "date-fns";
import { toast } from "sonner";
import { TeamChat } from "@/components/Teams/TeamChat";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TeamSelectionDialog } from "./TeamSelectionDialog";

interface Team {
  id: string;
  name: string;
}

interface TeamChallenge {
  id: string;
  title: string;
  description: string;
  target_type: string;
  target_value: number;
  ends_at: string;
  current_progress?: number;
  team_id?: string;
}

export function TeamChallengesList() {
  const [challenges, setChallenges] = useState<TeamChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamSelectionOpen, setTeamSelectionOpen] = useState(false);
  const [userTeams, setUserTeams] = useState<Team[]>([]);
  const [pendingChallengeId, setPendingChallengeId] = useState<string | null>(null);
  const [pendingChallengeTitle, setPendingChallengeTitle] = useState<string>("");

  useEffect(() => {
    fetchChallenges();
  }, []);

  const fetchChallenges = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's teams
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id);

      const teamIds = teamMembers?.map(tm => tm.team_id) || [];

      // Get all active challenges
      const { data: challengesData } = await supabase
        .from('team_challenges')
        .select('*')
        .gte('ends_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (challengesData && teamIds.length > 0) {
        // Get progress for user's teams
        const { data: progressData } = await supabase
          .from('team_challenge_progress')
          .select('*')
          .in('team_id', teamIds);

        const challengesWithProgress = challengesData.map(challenge => {
          const progress = progressData?.find(
            p => p.challenge_id === challenge.id
          );
          return {
            ...challenge,
            current_progress: progress?.current_progress || 0,
            team_id: progress?.team_id
          };
        });

        setChallenges(challengesWithProgress);
      } else {
        setChallenges(challengesData || []);
      }
    } catch (error) {
      console.error('Error fetching challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  const initiateJoinChallenge = async (challengeId: string, challengeTitle: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's teams where they are the creator
      const { data: teams } = await supabase
        .from('teams')
        .select('id, name')
        .eq('creator_id', user.id);

      if (!teams || teams.length === 0) {
        toast.error("Only team creators can join team challenges. Create a team first!");
        return;
      }

      // If user has only one team, join directly
      if (teams.length === 1) {
        await joinWithTeam(teams[0], challengeId);
      } else {
        // Show team selection dialog
        setUserTeams(teams);
        setPendingChallengeId(challengeId);
        setPendingChallengeTitle(challengeTitle);
        setTeamSelectionOpen(true);
      }
    } catch (error) {
      console.error('Error initiating join:', error);
      toast.error("Failed to join challenge");
    }
  };

  const joinWithTeam = async (team: Team, challengeId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('join-team-challenge', {
        body: {
          team_id: team.id,
          challenge_id: challengeId
        }
      });

      if (error) {
        // If we get an error object from invoke, it might be a network error or explicitly thrown by Supabase client
        throw error;
      }

      // Check if the function returned an application-level error
      if (data && data.error) {
        throw new Error(data.error);
      }

      toast.success(`Team "${team.name}" joined the challenge!`);
      // Refresh challenges list
      fetchChallenges();
    } catch (error) {
      console.error('Error joining challenge:', error);
      toast.error(error instanceof Error ? error.message : "Failed to join challenge");
    }
  };

  const handleTeamSelected = (team: Team) => {
    if (pendingChallengeId) {
      joinWithTeam(team, pendingChallengeId);
      setPendingChallengeId(null);
      setPendingChallengeTitle("");
    }
  };

  if (loading) {
    return <div className="text-center text-muted-foreground">Loading challenges...</div>;
  }

  if (challenges.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No active team challenges right now. Check back soon!</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {challenges.map((challenge) => {
        const progress = ((challenge.current_progress || 0) / challenge.target_value) * 100;
        const hasJoined = challenge.team_id !== undefined;
        const daysLeft = Math.ceil((new Date(challenge.ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

        return (
          <Card key={challenge.id} className="p-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-gold" />
                    <h3 className="text-lg font-bold">{challenge.title}</h3>
                    {hasJoined && challenge.team_id && (
                      <>
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {challenge.team_name || 'Your Team'}
                        </Badge>
                        <Sheet>
                          <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                              <MessageCircle className="w-4 h-4" />
                            </Button>
                          </SheetTrigger>
                          <SheetContent side="right" className="w-[400px] sm:w-[540px] p-0">
                            <div className="h-full pt-10">
                              <TeamChat teamId={challenge.team_id} />
                            </div>
                          </SheetContent>
                        </Sheet>
                      </>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{challenge.description}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <Badge className="bg-primary/20 text-primary border-primary/30">
                      <Target className="w-3 h-3 mr-1" />
                      {challenge.target_value} {challenge.target_type.replace('_', ' ')}
                    </Badge>
                    <span className="text-muted-foreground">{daysLeft} days left</span>
                  </div>
                </div>
                {!hasJoined && (
                  <Button onClick={() => initiateJoinChallenge(challenge.id, challenge.title)}>
                    Join Challenge
                  </Button>
                )}
              </div>

              {hasJoined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Team Progress</span>
                    <span className="font-medium">{challenge.current_progress} / {challenge.target_value}</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}
            </div>
          </Card>
        );
      })}

      <TeamSelectionDialog
        open={teamSelectionOpen}
        onOpenChange={setTeamSelectionOpen}
        teams={userTeams}
        onTeamSelected={handleTeamSelected}
        challengeTitle={pendingChallengeTitle}
      />
    </div>
  );
}