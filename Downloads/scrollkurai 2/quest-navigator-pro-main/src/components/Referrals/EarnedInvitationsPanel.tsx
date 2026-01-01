import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Gift, Copy, Check, UserPlus, Clock } from "lucide-react";

interface EarnedInvitation {
    id: string;
    invite_code: string;
    earned_at: string;
    earned_reason: string;
    used_by_user_id: string | null;
    used_at: string | null;
    expires_at: string;
}

const REASON_LABELS: Record<string, string> = {
    streak_7: "7-Day Streak",
    streak_30: "30-Day Streak",
    level_10: "Level 10 Reached",
    first_month: "First Month",
};

export function EarnedInvitationsPanel() {
    const [invitations, setInvitations] = useState<EarnedInvitation[]>([]);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState<string | null>(null);

    useEffect(() => {
        fetchInvitations();
    }, []);

    const fetchInvitations = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from("earned_invitations")
                .select("*")
                .eq("owner_user_id", user.id)
                .order("earned_at", { ascending: false });

            if (error) throw error;
            setInvitations(data || []);
        } catch (error) {
            console.error("Error fetching invitations:", error);
        } finally {
            setLoading(false);
        }
    };

    const copyCode = async (code: string) => {
        await navigator.clipboard.writeText(code);
        setCopied(code);
        toast.success("Invite code copied!");
        setTimeout(() => setCopied(null), 3000);
    };

    const getInviteLink = (code: string) => {
        const baseUrl = window.location.origin;
        return `${baseUrl}/?invite=${code}`;
    };

    if (loading) {
        return (
            <Card className="p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-muted rounded w-1/3" />
                    <div className="h-20 bg-muted rounded" />
                </div>
            </Card>
        );
    }

    const availableInvites = invitations.filter(
        (inv) => !inv.used_by_user_id && new Date(inv.expires_at) > new Date()
    );
    const usedInvites = invitations.filter((inv) => inv.used_by_user_id);

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                    <Gift className="w-5 h-5 text-primary" />
                    Earned Invitations
                    <Badge variant="secondary" className="ml-auto">{availableInvites.length} available</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* No invitations message */}
                {invitations.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                        <UserPlus className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Earn invitations through discipline</p>
                        <p className="text-xs mt-1">Hit streak milestones to unlock exclusive invite codes</p>
                    </div>
                )}

                {/* Available Invitations */}
                {availableInvites.length > 0 && (
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground">Available to Share</h4>
                        {availableInvites.map((invite) => (
                            <div key={invite.id} className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                                <div className="flex items-center justify-between mb-2">
                                    <Badge variant="outline">{REASON_LABELS[invite.earned_reason] || invite.earned_reason}</Badge>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Clock className="w-3 h-3" />
                                        Expires {new Date(invite.expires_at).toLocaleDateString()}
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <Input
                                        value={invite.invite_code}
                                        readOnly
                                        className="font-mono text-center"
                                    />
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => copyCode(invite.invite_code)}
                                    >
                                        {copied === invite.invite_code ? (
                                            <Check className="w-4 h-4 text-green-500" />
                                        ) : (
                                            <Copy className="w-4 h-4" />
                                        )}
                                    </Button>
                                </div>

                                <p className="text-xs text-muted-foreground text-center mt-2 italic">
                                    "Invite one person to witness your discipline."
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Used Invitations */}
                {usedInvites.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground">Used Invitations</h4>
                        {usedInvites.map((invite) => (
                            <div key={invite.id} className="p-3 rounded-lg bg-muted/50 flex items-center justify-between">
                                <div>
                                    <p className="font-mono text-sm">{invite.invite_code}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Used {invite.used_at && new Date(invite.used_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <Badge className="bg-green-500/20 text-green-500">Used</Badge>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
