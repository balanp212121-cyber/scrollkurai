import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
    MessageCircle,
    Clock,
    CheckCircle,
    XCircle,
    Calendar,
    Link as LinkIcon,
    Loader2,
    User,
    RefreshCw
} from "lucide-react";

interface CounsellingRequest {
    id: string;
    user_id: string;
    concern_summary: string;
    preferred_times: string | null;
    additional_notes: string | null;
    status: string;
    meeting_link: string | null;
    session_scheduled_for: string | null;
    created_at: string;
    admin_notes: string | null;
    profiles?: {
        username: string | null;
    };
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    pending: { label: "Pending", color: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30" },
    confirmed: { label: "Confirmed", color: "bg-green-500/20 text-green-500 border-green-500/30" },
    declined: { label: "Declined", color: "bg-red-500/20 text-red-500 border-red-500/30" },
    completed: { label: "Completed", color: "bg-primary/20 text-primary border-primary/30" },
    cancelled: { label: "Cancelled", color: "bg-muted text-muted-foreground border-muted" },
    no_show: { label: "No Show", color: "bg-orange-500/20 text-orange-500 border-orange-500/30" },
};

export function CounsellingRequestsPanel() {
    const [requests, setRequests] = useState<CounsellingRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState<CounsellingRequest | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Dialog form state
    const [meetingLink, setMeetingLink] = useState("");
    const [scheduledFor, setScheduledFor] = useState("");
    const [adminNotes, setAdminNotes] = useState("");

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('counselling_requests')
                .select(`
          *,
          profiles:user_id (username)
        `)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setRequests(data || []);
        } catch (error) {
            console.error('Error fetching requests:', error);
            toast.error("Failed to load counselling requests");
        } finally {
            setLoading(false);
        }
    };

    const openDialog = (request: CounsellingRequest) => {
        setSelectedRequest(request);
        setMeetingLink(request.meeting_link || "");
        setScheduledFor(request.session_scheduled_for ?
            new Date(request.session_scheduled_for).toISOString().slice(0, 16) : "");
        setAdminNotes(request.admin_notes || "");
        setDialogOpen(true);
    };

    const handleConfirm = async () => {
        if (!selectedRequest) return;

        if (!meetingLink.trim() || !scheduledFor) {
            toast.error("Please provide meeting link and scheduled time");
            return;
        }

        setSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const { error } = await supabase
                .from('counselling_requests')
                .update({
                    status: 'confirmed',
                    meeting_link: meetingLink.trim(),
                    session_scheduled_for: new Date(scheduledFor).toISOString(),
                    admin_notes: adminNotes.trim() || null,
                    reviewed_by: user?.id,
                    reviewed_at: new Date().toISOString()
                })
                .eq('id', selectedRequest.id);

            if (error) throw error;

            // Unified admin audit log (fire-and-forget)
            try {
                await (supabase as any).from('admin_audit_logs').insert({
                    admin_user_id: user?.id,
                    action: 'counselling_confirm',
                    target_type: 'counselling_request',
                    target_id: selectedRequest.id,
                    metadata: {
                        user_id: selectedRequest.user_id,
                        scheduled_for: scheduledFor
                    }
                });
            } catch (e) {
                console.warn('Audit log failed (non-blocking):', e);
            }

            toast.success("Session confirmed!", {
                description: "The user will be notified via email"
            });

            setDialogOpen(false);
            fetchRequests();
        } catch (error) {
            console.error('Error confirming request:', error);
            toast.error("Failed to confirm session");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDecline = async () => {
        if (!selectedRequest) return;

        setSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const { error } = await supabase
                .from('counselling_requests')
                .update({
                    status: 'declined',
                    admin_notes: adminNotes.trim() || "Your request could not be accommodated at this time.",
                    reviewed_by: user?.id,
                    reviewed_at: new Date().toISOString()
                })
                .eq('id', selectedRequest.id);

            if (error) throw error;

            // Unified admin audit log (fire-and-forget)
            try {
                await (supabase as any).from('admin_audit_logs').insert({
                    admin_user_id: user?.id,
                    action: 'counselling_decline',
                    target_type: 'counselling_request',
                    target_id: selectedRequest.id,
                    metadata: {
                        user_id: selectedRequest.user_id,
                        reason: adminNotes.trim() || null
                    }
                });
            } catch (e) {
                console.warn('Audit log failed (non-blocking):', e);
            }

            toast.success("Request declined");
            setDialogOpen(false);
            fetchRequests();
        } catch (error) {
            console.error('Error declining request:', error);
            toast.error("Failed to decline request");
        } finally {
            setSubmitting(false);
        }
    };

    const handleComplete = async (requestId: string) => {
        try {
            const { error } = await supabase
                .from('counselling_requests')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString()
                })
                .eq('id', requestId);

            if (error) throw error;
            toast.success("Session marked as completed");
            fetchRequests();
        } catch (error) {
            console.error('Error completing request:', error);
            toast.error("Failed to update status");
        }
    };

    const pendingCount = requests.filter(r => r.status === 'pending').length;

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-bold">Counselling Requests</h2>
                    {pendingCount > 0 && (
                        <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                            {pendingCount} pending
                        </Badge>
                    )}
                </div>
                <Button variant="outline" size="sm" onClick={fetchRequests}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                </Button>
            </div>

            {/* Requests List */}
            {requests.length === 0 ? (
                <Card className="p-8 text-center">
                    <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No counselling requests yet</p>
                </Card>
            ) : (
                <div className="space-y-3">
                    {requests.map((request) => (
                        <Card key={request.id} className="p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <User className="w-4 h-4 text-muted-foreground" />
                                        <span className="font-medium">
                                            {request.profiles?.username || "Anonymous User"}
                                        </span>
                                        <Badge className={STATUS_CONFIG[request.status]?.color || "bg-muted"}>
                                            {STATUS_CONFIG[request.status]?.label || request.status}
                                        </Badge>
                                    </div>

                                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                        {request.concern_summary}
                                    </p>

                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(request.created_at).toLocaleDateString()}
                                        </span>
                                        {request.session_scheduled_for && (
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(request.session_scheduled_for).toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    {request.status === 'pending' && (
                                        <Button size="sm" onClick={() => openDialog(request)}>
                                            Review
                                        </Button>
                                    )}
                                    {request.status === 'confirmed' && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleComplete(request.id)}
                                        >
                                            Mark Complete
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Review Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Review Counselling Request</DialogTitle>
                    </DialogHeader>

                    {selectedRequest && (
                        <div className="space-y-4">
                            <div>
                                <Label className="text-sm font-medium text-muted-foreground">User's Concern</Label>
                                <p className="text-sm mt-1">{selectedRequest.concern_summary}</p>
                            </div>

                            {selectedRequest.preferred_times && (
                                <div>
                                    <Label className="text-sm font-medium text-muted-foreground">Preferred Times</Label>
                                    <p className="text-sm mt-1">{selectedRequest.preferred_times}</p>
                                </div>
                            )}

                            {selectedRequest.additional_notes && (
                                <div>
                                    <Label className="text-sm font-medium text-muted-foreground">Additional Notes</Label>
                                    <p className="text-sm mt-1">{selectedRequest.additional_notes}</p>
                                </div>
                            )}

                            <div className="border-t pt-4 space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="meeting-link">Meeting Link (Zoom/Meet/Teams)</Label>
                                    <div className="flex gap-2">
                                        <LinkIcon className="w-4 h-4 mt-3 text-muted-foreground" />
                                        <Input
                                            id="meeting-link"
                                            placeholder="https://zoom.us/j/..."
                                            value={meetingLink}
                                            onChange={(e) => setMeetingLink(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="scheduled-for">Scheduled Date & Time</Label>
                                    <Input
                                        id="scheduled-for"
                                        type="datetime-local"
                                        value={scheduledFor}
                                        onChange={(e) => setScheduledFor(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="admin-notes">Notes for User (Optional)</Label>
                                    <Textarea
                                        id="admin-notes"
                                        placeholder="Any instructions or notes for the user..."
                                        value={adminNotes}
                                        onChange={(e) => setAdminNotes(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button
                                    onClick={handleConfirm}
                                    disabled={submitting}
                                    className="flex-1"
                                >
                                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                                        <>
                                            <CheckCircle className="w-4 h-4 mr-2" />
                                            Confirm Session
                                        </>
                                    )}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={handleDecline}
                                    disabled={submitting}
                                >
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Decline
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
