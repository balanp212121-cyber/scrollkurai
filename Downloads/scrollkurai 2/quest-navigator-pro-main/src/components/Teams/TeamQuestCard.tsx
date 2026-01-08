import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, Flame, Target, CheckCircle2, Loader2, Swords } from "lucide-react";

interface TeamMemberProgress {
    user_id: string;
    progress_percent: number;
    username?: string;
    is_flagged: boolean;
}

interface TeamQuest {
    id: string;
    quest_id: string;
    status: string;
    started_at: string;
    xp_reward: number;
    quest?: {
        content: string;
        reflection_prompt: string;
    };
    progress?: TeamMemberProgress[];
}

interface TeamStreak {
    current_streak: number;
    longest_streak: number;
    last_completed_date: string;
}

interface TeamRivalry {
    id: string;
    team_a: string;
    team_b: string;
    team_a_score: number;
    team_b_score: number;
    ends_at: string;
    rival_team_name?: string;
}

interface TeamQuestCardProps {
    teamId: string;
    teamName: string;
}

export function TeamQuestCard({ teamId, teamName }: TeamQuestCardProps) {
    const [activeQuests, setActiveQuests] = useState<TeamQuest[]>([]);
    const [streak, setStreak] = useState<TeamStreak | null>(null);
    const [rivalry, setRivalry] = useState<TeamRivalry | null>(null);
    const [loading, setLoading] = useState(true);
    const [updatingProgress, setUpdatingProgress] = useState<string | null>(null);

    useEffect(() => {
        fetchTeamData();
    }, [teamId]);

    const fetchTeamData = async () => {
        try {
            // Fetch active team quests
            const { data: quests } = await supabase
                .from('team_quests')
                .select(`
          id, quest_id, status, started_at, xp_reward,
          quests (content, reflection_prompt)
        `)
                .eq('team_id', teamId)
                .eq('status', 'active');

            if (quests && quests.length > 0) {
                // Fetch progress for each quest
                const questsWithProgress = await Promise.all(
                    quests.map(async (quest: any) => {
                        const { data: progress } = await supabase
                            .from('team_quest_progress')
                            .select('user_id, progress_percent, is_flagged')
                            .eq('team_quest_id', quest.id);

                        return {
                            ...quest,
                            quest: quest.quests,
                            progress: progress || []
                        };
                    })
                );
                setActiveQuests(questsWithProgress);
            }

            // Fetch team streak
            const { data: streakData } = await supabase
                .from('team_streaks')
                .select('*')
                .eq('team_id', teamId)
                .single();

            if (streakData) {
                setStreak(streakData);
            }

            // Fetch active rivalry
            const { data: rivalryData } = await supabase
                .from('team_rivalries')
                .select('*')
                .or(`team_a.eq.${teamId},team_b.eq.${teamId}`)
                .eq('is_active', true)
                .single();

            if (rivalryData) {
                setRivalry(rivalryData);
            }
        } catch (error) {
            console.error('Error fetching team data:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateProgress = async (teamQuestId: string, newProgress: number) => {
        setUpdatingProgress(teamQuestId);
        try {
            const { data, error } = await supabase.rpc('update_team_quest_progress', {
                p_team_quest_id: teamQuestId,
                p_progress_percent: newProgress
            });

            if (error) throw error;

            if (data?.flagged) {
                toast.error("Progress update blocked", {
                    description: data.message
                });
            } else {
                toast.success("Progress updated! 🎯");
                fetchTeamData();
            }
        } catch (error) {
            console.error('Error updating progress:', error);
            toast.error("Failed to update progress");
        } finally {
            setUpdatingProgress(null);
        }
    };

    const getTeamCompletionPercent = (quest: TeamQuest): number => {
        if (!quest.progress || quest.progress.length === 0) return 0;
        const eligibleCount = quest.progress.filter(p => p.progress_percent >= 80 && !p.is_flagged).length;
        return Math.round((eligibleCount / quest.progress.length) * 100);
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
            {/* Team Header with Streak */}
            <Card className="p-4 bg-gradient-to-r from-primary/10 to-accent/10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Users className="h-6 w-6 text-primary" />
                        <div>
                            <h3 className="font-bold">{teamName}</h3>
                            <p className="text-sm text-muted-foreground">Team Quests</p>
                        </div>
                    </div>

                    {streak && (
                        <div className="flex items-center gap-2">
                            <Flame className="h-5 w-5 text-orange-500" />
                            <span className="font-bold text-lg">{streak.current_streak}</span>
                            <span className="text-xs text-muted-foreground">day streak</span>
                        </div>
                    )}
                </div>
            </Card>

            {/* Active Rivalry */}
            {rivalry && (
                <Card className="p-4 bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-500/20">
                    <div className="flex items-center gap-2 mb-3">
                        <Swords className="h-5 w-5 text-red-500" />
                        <span className="font-semibold">Active Rivalry</span>
                        <Badge variant="outline" className="ml-auto text-xs">
                            Ends in {Math.ceil((new Date(rivalry.ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days
                        </Badge>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <p className="text-sm font-medium">{teamName}</p>
                            <p className="text-2xl font-bold text-primary">
                                {rivalry.team_a === teamId ? rivalry.team_a_score : rivalry.team_b_score}
                            </p>
                        </div>
                        <div className="text-muted-foreground font-bold">VS</div>
                        <div className="flex-1 text-right">
                            <p className="text-sm font-medium">{rivalry.rival_team_name || 'Rival Team'}</p>
                            <p className="text-2xl font-bold text-red-500">
                                {rivalry.team_a === teamId ? rivalry.team_b_score : rivalry.team_a_score}
                            </p>
                        </div>
                    </div>
                </Card>
            )}

            {/* Active Team Quests */}
            {activeQuests.length === 0 ? (
                <Card className="p-6 text-center">
                    <Target className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No active team quests</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        Team admins can accept quests for the team
                    </p>
                </Card>
            ) : (
                activeQuests.map((quest) => (
                    <Card key={quest.id} className="p-4">
                        <div className="space-y-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h4 className="font-semibold">{quest.quest?.content}</h4>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {quest.quest?.reflection_prompt}
                                    </p>
                                </div>
                                <Badge className="bg-primary/20 text-primary">
                                    +{quest.xp_reward} XP
                                </Badge>
                            </div>

                            {/* Team Progress */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-muted-foreground">Team Progress</span>
                                    <span className="text-sm font-medium">{getTeamCompletionPercent(quest)}%</span>
                                </div>
                                <Progress value={getTeamCompletionPercent(quest)} className="h-2" />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Need 70% of team at 80%+ to complete
                                </p>
                            </div>

                            {/* Member Progress Circles */}
                            <div className="flex flex-wrap gap-2">
                                {quest.progress?.map((member) => (
                                    <div
                                        key={member.user_id}
                                        className={`relative w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs font-bold
                      ${member.progress_percent >= 80
                                                ? 'border-green-500 bg-green-500/20 text-green-500'
                                                : member.is_flagged
                                                    ? 'border-red-500 bg-red-500/20 text-red-500'
                                                    : 'border-muted bg-muted/20 text-muted-foreground'
                                            }`}
                                        title={member.is_flagged ? 'Flagged for review' : `${member.progress_percent}%`}
                                    >
                                        {member.progress_percent >= 100 ? (
                                            <CheckCircle2 className="h-5 w-5" />
                                        ) : (
                                            `${member.progress_percent}%`
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Update Progress Button */}
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateProgress(quest.id, 25)}
                                    disabled={updatingProgress === quest.id}
                                >
                                    +25%
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateProgress(quest.id, 50)}
                                    disabled={updatingProgress === quest.id}
                                >
                                    +50%
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => updateProgress(quest.id, 100)}
                                    disabled={updatingProgress === quest.id}
                                >
                                    {updatingProgress === quest.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        "Complete"
                                    )}
                                </Button>
                            </div>
                        </div>
                    </Card>
                ))
            )}
        </div>
    );
}
