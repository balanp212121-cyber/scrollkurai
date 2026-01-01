import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, Users, UserCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface PendingChallenge {
    id: string;
    title: string;
    description: string;
    challenge_type: string;
    creator_id: string;
    creator_username: string;
    created_at: string;
    approval_status: string;
}

export function PendingChallengesPanel() {
    const queryClient = useQueryClient();
    const [processingId, setProcessingId] = useState<string | null>(null);

    const { data: pendingChallenges, isLoading } = useQuery({
        queryKey: ["pending-challenges"],
        queryFn: async () => {
            const { data, error } = await (supabase.rpc as any)("get_pending_challenges");
            if (error) throw error;
            return data as PendingChallenge[];
        },
        refetchInterval: 30000, // Refresh every 30s
    });

    const approveMutation = useMutation({
        mutationFn: async ({ challengeId, action }: { challengeId: string; action: "approve" | "reject" }) => {
            const { data, error } = await (supabase.rpc as any)("admin_approve_challenge", {
                p_challenge_id: challengeId,
                p_action: action,
            });
            if (error) throw error;
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["pending-challenges"] });
            toast.success(`Challenge ${variables.action === "approve" ? "approved" : "rejected"} successfully`);
        },
        onError: (error: any) => {
            toast.error(error.message || "Failed to update challenge");
        },
        onSettled: () => {
            setProcessingId(null);
        },
    });

    const handleAction = (challengeId: string, action: "approve" | "reject") => {
        setProcessingId(challengeId);
        approveMutation.mutate({ challengeId, action });
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        Pending Challenges
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">Loading...</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-500" />
                    Pending Challenges
                    {pendingChallenges && pendingChallenges.length > 0 && (
                        <Badge variant="destructive">{pendingChallenges.length}</Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {!pendingChallenges || pendingChallenges.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No pending challenges to review.</p>
                ) : (
                    <div className="space-y-4">
                        {pendingChallenges.map((challenge) => (
                            <div
                                key={challenge.id}
                                className="p-4 border rounded-lg bg-card/50 space-y-3"
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-medium">{challenge.title}</h4>
                                            <Badge variant="outline" className="text-xs">
                                                {challenge.challenge_type === "duo" ? (
                                                    <><UserCheck className="w-3 h-3 mr-1" /> Duo</>
                                                ) : (
                                                    <><Users className="w-3 h-3 mr-1" /> Team</>
                                                )}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-1">{challenge.description}</p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>
                                        Created by <span className="font-medium">{challenge.creator_username || "Unknown"}</span>
                                        {" · "}
                                        {formatDistanceToNow(new Date(challenge.created_at), { addSuffix: true })}
                                    </span>
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        className="bg-green-600 hover:bg-green-700"
                                        onClick={() => handleAction(challenge.id, "approve")}
                                        disabled={processingId === challenge.id}
                                    >
                                        <CheckCircle2 className="w-4 h-4 mr-1" />
                                        Approve
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => handleAction(challenge.id, "reject")}
                                        disabled={processingId === challenge.id}
                                    >
                                        <XCircle className="w-4 h-4 mr-1" />
                                        Reject
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
