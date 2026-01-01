import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Users, CheckCircle2, Clock, Loader2 } from "lucide-react";

interface Participant {
  id: string;
  user_id: string;
  current_progress: number;
  completed: boolean;
  joined_at: string;
  username: string | null;
  baseline_quests: number | null;
  baseline_xp: number | null;
  baseline_streak: number | null;
}

interface ViewParticipantsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challengeId: string | null;
  challengeTitle: string;
  targetValue: number;
  targetType: string;
  isAdmin?: boolean; // If true, show full participant list. If false, show only count + own progress
  currentUserId?: string; // For showing own progress to non-admins
}

export function ViewParticipantsModal({
  open,
  onOpenChange,
  challengeId,
  challengeTitle,
  targetValue,
  targetType,
  isAdmin = false,
  currentUserId,
}: ViewParticipantsModalProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && challengeId) {
      fetchParticipants();
    }
  }, [open, challengeId]);

  const fetchParticipants = async () => {
    if (!challengeId) return;

    setLoading(true);
    try {
      // First fetch participants with baseline values
      const { data: participantsData, error: participantsError } = await supabase
        .from("challenge_participants")
        .select("id, user_id, current_progress, completed, joined_at, baseline_quests, baseline_xp, baseline_streak")
        .eq("challenge_id", challengeId)
        .order("joined_at", { ascending: false });

      if (participantsError) {
        console.error("Error fetching participants:", participantsError);
        setParticipants([]);
        return;
      }

      if (!participantsData || participantsData.length === 0) {
        setParticipants([]);
        return;
      }

      // Get user IDs
      const userIds = participantsData.map(p => p.user_id);

      // Fetch profiles using admin RPC function (bypasses friend-only restriction)
      const { data: profilesData, error: profilesError } = await supabase
        .rpc("get_profiles_by_ids_admin", { user_ids: userIds });

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
      }
      // Create a map of user_id to username
      const usernameMap: Record<string, string> = {};
      if (profilesData) {
        profilesData.forEach((profile: { id: string; username: string | null }) => {
          usernameMap[profile.id] = profile.username || "Unknown User";
        });
      }

      // Merge data
      const mergedData = participantsData.map(p => ({
        ...p,
        username: usernameMap[p.user_id] || "Unknown User",
        baseline_quests: p.baseline_quests ?? 0,
        baseline_xp: p.baseline_xp ?? 0,
        baseline_streak: p.baseline_streak ?? 0,
      }));

      setParticipants(mergedData);
    } catch (error) {
      console.error("Error:", error);
      setParticipants([]);
    } finally {
      setLoading(false);
    }
  };

  const completedCount = participants.filter(p => p.completed).length;
  const inProgressCount = participants.filter(p => !p.completed).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Participants: {challengeTitle}
          </DialogTitle>
        </DialogHeader>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 py-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">{participants.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <p className="text-2xl font-bold text-green-500">{completedCount}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-2xl font-bold text-amber-500">{inProgressCount}</p>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </div>
        </div>

        {/* Table - Admin Only OR Own Progress for Non-Admin */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading participants...</span>
            </div>
          ) : participants.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No participants yet</p>
            </div>
          ) : !isAdmin ? (
            /* Non-admin view: Only show own progress */
            <div className="space-y-4">
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  Participant details are visible to admins only.
                </p>
              </div>
              {/* Show own progress if user is a participant */}
              {currentUserId && (
                <>
                  {participants
                    .filter(p => p.user_id === currentUserId)
                    .map(participant => {
                      const progressPercent = (participant.current_progress / targetValue) * 100;
                      return (
                        <div key={participant.id} className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
                          <p className="font-medium text-sm mb-2">Your Progress</p>
                          <Progress value={Math.min(progressPercent, 100)} className="h-2 mb-1" />
                          <p className="text-xs text-muted-foreground">
                            {participant.current_progress} / {targetValue} • {participant.completed ? '✅ Completed' : '⏳ In Progress'}
                          </p>
                        </div>
                      );
                    })}
                </>
              )}
            </div>
          ) : (
            /* Admin view: Full participant table */
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Baseline</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participants.map((participant) => {
                  const progressPercent = (participant.current_progress / targetValue) * 100;
                  // Get the relevant baseline based on target type
                  const getBaselineValue = () => {
                    switch (targetType) {
                      case 'quests': return participant.baseline_quests;
                      case 'xp': return participant.baseline_xp;
                      case 'streak': return participant.baseline_streak;
                      default: return participant.baseline_quests;
                    }
                  };
                  const baselineValue = getBaselineValue();

                  return (
                    <TableRow key={participant.id}>
                      <TableCell className="font-medium">
                        {participant.username}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 min-w-[100px]">
                          <Progress value={Math.min(progressPercent, 100)} className="h-2" />
                          <p className="text-xs text-muted-foreground">
                            {participant.current_progress} / {targetValue}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-0.5">
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">{baselineValue}</span>
                            <span className="ml-1">({targetType})</span>
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {participant.completed ? (
                          <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Completed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-500/30 text-amber-500">
                            <Clock className="w-3 h-3 mr-1" />
                            In Progress
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(participant.joined_at), "MMM d, yyyy")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
