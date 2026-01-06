import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Link2, LogOut, Trash2, Copy, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface TeamManagementActionsProps {
    teamId: string;
    teamName: string;
    teamType: 'team' | 'duo';
    isCreator: boolean;
    isMember: boolean;
    onActionComplete?: () => void;
}

export function TeamManagementActions({
    teamId,
    teamName,
    teamType,
    isCreator,
    isMember,
    onActionComplete
}: TeamManagementActionsProps) {
    const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
    const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
    const [dissolveDialogOpen, setDissolveDialogOpen] = useState(false);
    const [inviteLink, setInviteLink] = useState("");
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    // Generate invite link (creator only)
    const handleGenerateInvite = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('generate_invite_link', {
                p_entity_id: teamId,
                p_expires_in_days: 7
            });

            if (error) throw error;

            if (data && data.length > 0) {
                const token = data[0].token;
                const link = `${window.location.origin}/join/${token}`;
                setInviteLink(link);
                toast.success("Invite link generated!");
            }
        } catch (error: any) {
            console.error('Generate invite error:', error);
            toast.error(error.message || "Failed to generate invite link");
        } finally {
            setLoading(false);
        }
    };

    // Copy invite link
    const handleCopy = () => {
        navigator.clipboard.writeText(inviteLink);
        setCopied(true);
        toast.success("Link copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
    };

    // Leave team (non-creator only)
    const handleLeaveTeam = async () => {
        setLoading(true);
        try {
            const { error } = await supabase.rpc('leave_team', {
                p_team_id: teamId
            });

            if (error) throw error;

            toast.success(`You have left ${teamType === 'duo' ? 'the Duo' : 'the Team'}`);
            setLeaveDialogOpen(false);
            onActionComplete?.();
        } catch (error: any) {
            console.error('Leave team error:', error);
            toast.error(error.message || "Failed to leave team");
        } finally {
            setLoading(false);
        }
    };

    // Dissolve team/duo
    const handleDissolve = async () => {
        setLoading(true);
        try {
            const { error } = await supabase.rpc('dissolve_team', {
                p_team_id: teamId
            });

            if (error) throw error;

            toast.success(`${teamType === 'duo' ? 'Duo' : 'Team'} has been dissolved`);
            setDissolveDialogOpen(false);
            onActionComplete?.();
        } catch (error: any) {
            console.error('Dissolve team error:', error);
            toast.error(error.message || "Failed to dissolve");
        } finally {
            setLoading(false);
        }
    };

    if (!isMember) return null;

    return (
        <div className="flex flex-wrap gap-2">
            {/* Generate Invite Link - Creator only */}
            {isCreator && (
                <>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setInviteDialogOpen(true);
                            handleGenerateInvite();
                        }}
                        className="gap-2"
                    >
                        <Link2 className="w-4 h-4" />
                        Invite Link
                    </Button>

                    <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Invite Link</DialogTitle>
                                <DialogDescription>
                                    Share this link with friends to invite them to your {teamType}.
                                    Link expires in 7 days.
                                </DialogDescription>
                            </DialogHeader>

                            {loading ? (
                                <div className="text-center py-4">Generating...</div>
                            ) : inviteLink ? (
                                <div className="space-y-4">
                                    <div className="flex gap-2">
                                        <Input
                                            value={inviteLink}
                                            readOnly
                                            className="font-mono text-sm"
                                        />
                                        <Button onClick={handleCopy} size="icon" variant="outline">
                                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Only your friends can join using this link.
                                    </p>
                                </div>
                            ) : (
                                <div className="text-center py-4 text-muted-foreground">
                                    Failed to generate link
                                </div>
                            )}
                        </DialogContent>
                    </Dialog>
                </>
            )}

            {/* Leave Team - Non-creator only (for teams), or either member (for duos) */}
            {!isCreator && teamType === 'team' && (
                <>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLeaveDialogOpen(true)}
                        className="gap-2 text-muted-foreground hover:text-destructive"
                    >
                        <LogOut className="w-4 h-4" />
                        Leave Team
                    </Button>

                    <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Leave Team</DialogTitle>
                                <DialogDescription>
                                    Are you sure you want to leave "{teamName}"?
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setLeaveDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={handleLeaveTeam}
                                    disabled={loading}
                                >
                                    {loading ? "Leaving..." : "Leave Team"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </>
            )}

            {/* Dissolve - Creator for teams, Either member for duos */}
            {(isCreator || teamType === 'duo') && (
                <>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDissolveDialogOpen(true)}
                        className="gap-2 text-muted-foreground hover:text-destructive"
                    >
                        <Trash2 className="w-4 h-4" />
                        Dissolve {teamType === 'duo' ? 'Duo' : 'Team'}
                    </Button>

                    <Dialog open={dissolveDialogOpen} onOpenChange={setDissolveDialogOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-destructive">
                                    <AlertTriangle className="w-5 h-5" />
                                    Dissolve {teamType === 'duo' ? 'Duo' : 'Team'}
                                </DialogTitle>
                                <DialogDescription className="space-y-2">
                                    <p>Are you sure you want to dissolve "{teamName}"?</p>
                                    <p className="font-medium text-destructive">
                                        This will remove all members and end any active challenges.
                                        This action cannot be undone.
                                    </p>
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDissolveDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={handleDissolve}
                                    disabled={loading}
                                >
                                    {loading ? "Dissolving..." : `Dissolve ${teamType === 'duo' ? 'Duo' : 'Team'}`}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </>
            )}
        </div>
    );
}
