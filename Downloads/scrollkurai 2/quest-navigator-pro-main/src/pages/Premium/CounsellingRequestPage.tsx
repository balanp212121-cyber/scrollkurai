import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
    MessageCircle,
    Clock,
    CheckCircle,
    Calendar,
    Video,
    AlertCircle,
    Loader2
} from "lucide-react";
import { PremiumRouteGuard } from "@/components/Premium/PremiumRouteGuard";

interface CounsellingRequest {
    id: string;
    concern_summary: string;
    preferred_times: string | null;
    additional_notes: string | null;
    status: string;
    meeting_link: string | null;
    session_scheduled_for: string | null;
    created_at: string;
    admin_notes: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    pending: { label: "Under Review", color: "bg-yellow-500/20 text-yellow-500", icon: <Clock className="w-3 h-3" /> },
    confirmed: { label: "Confirmed", color: "bg-green-500/20 text-green-500", icon: <CheckCircle className="w-3 h-3" /> },
    declined: { label: "Declined", color: "bg-red-500/20 text-red-500", icon: <AlertCircle className="w-3 h-3" /> },
    completed: { label: "Completed", color: "bg-primary/20 text-primary", icon: <CheckCircle className="w-3 h-3" /> },
    cancelled: { label: "Cancelled", color: "bg-muted text-muted-foreground", icon: <AlertCircle className="w-3 h-3" /> },
};

export default function CounsellingRequestPage() {
    const [existingRequest, setExistingRequest] = useState<CounsellingRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [concernSummary, setConcernSummary] = useState("");
    const [preferredTimes, setPreferredTimes] = useState("");
    const [additionalNotes, setAdditionalNotes] = useState("");

    useEffect(() => {
        fetchExistingRequest();
    }, []);

    const fetchExistingRequest = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('counselling_requests')
                .select('*')
                .eq('user_id', user.id)
                .in('status', ['pending', 'confirmed'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!error && data) {
                setExistingRequest(data);
            }
        } catch (error) {
            console.error('Error fetching request:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!concernSummary.trim()) {
            toast.error("Please describe your concern");
            return;
        }

        if (concernSummary.length < 20) {
            toast.error("Please provide more detail about your concern (at least 20 characters)");
            return;
        }

        setSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const { data, error } = await supabase
                .from('counselling_requests')
                .insert({
                    user_id: user.id,
                    concern_summary: concernSummary.trim(),
                    preferred_times: preferredTimes.trim() || null,
                    additional_notes: additionalNotes.trim() || null,
                    status: 'pending'
                })
                .select()
                .single();

            if (error) throw error;

            setExistingRequest(data);
            toast.success("Request submitted!", {
                description: "We'll review your request and get back to you within 48 hours."
            });

            // Clear form
            setConcernSummary("");
            setPreferredTimes("");
            setAdditionalNotes("");
        } catch (error) {
            console.error('Error submitting request:', error);
            toast.error("Failed to submit request", {
                description: "Please try again or contact support"
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = async () => {
        if (!existingRequest) return;

        try {
            const { error } = await supabase
                .from('counselling_requests')
                .update({ status: 'cancelled' })
                .eq('id', existingRequest.id);

            if (error) throw error;

            setExistingRequest(null);
            toast.success("Request cancelled");
        } catch (error) {
            console.error('Error cancelling request:', error);
            toast.error("Failed to cancel request");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <PremiumRouteGuard>
            <div className="pb-20 space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <MessageCircle className="w-8 h-8 text-primary" />
                    <div>
                        <h1 className="text-3xl font-bold">1-1 Counselling</h1>
                        <p className="text-sm text-muted-foreground">
                            Personal wellness guidance sessions
                        </p>
                    </div>
                </div>

                {/* Active Request */}
                {existingRequest && (
                    <Card className="p-6 space-y-4 border-primary/30">
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-lg font-bold">Your Active Request</h2>
                                <p className="text-sm text-muted-foreground">
                                    Submitted {new Date(existingRequest.created_at).toLocaleDateString()}
                                </p>
                            </div>
                            <Badge className={STATUS_CONFIG[existingRequest.status]?.color || "bg-muted"}>
                                {STATUS_CONFIG[existingRequest.status]?.icon}
                                <span className="ml-1">{STATUS_CONFIG[existingRequest.status]?.label}</span>
                            </Badge>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Your Concern</p>
                                <p className="text-sm">{existingRequest.concern_summary}</p>
                            </div>

                            {existingRequest.status === 'confirmed' && existingRequest.session_scheduled_for && (
                                <Card className="p-4 bg-green-500/10 border-green-500/30">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Calendar className="w-5 h-5 text-green-500" />
                                        <span className="font-bold">Session Confirmed!</span>
                                    </div>
                                    <p className="text-sm mb-3">
                                        Scheduled for: {new Date(existingRequest.session_scheduled_for).toLocaleString()}
                                    </p>
                                    {existingRequest.meeting_link && (
                                        <Button
                                            onClick={() => window.open(existingRequest.meeting_link!, '_blank')}
                                            className="w-full"
                                        >
                                            <Video className="w-4 h-4 mr-2" />
                                            Join Session
                                        </Button>
                                    )}
                                </Card>
                            )}

                            {existingRequest.admin_notes && (
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Note from Team</p>
                                    <p className="text-sm">{existingRequest.admin_notes}</p>
                                </div>
                            )}
                        </div>

                        {existingRequest.status === 'pending' && (
                            <Button variant="outline" onClick={handleCancel}>
                                Cancel Request
                            </Button>
                        )}
                    </Card>
                )}

                {/* New Request Form */}
                {!existingRequest && (
                    <Card className="p-6 space-y-6">
                        <div>
                            <h2 className="text-lg font-bold mb-1">Request a Session</h2>
                            <p className="text-sm text-muted-foreground">
                                Tell us what you'd like to discuss. A wellness coach will review your request and schedule a session.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="concern" className="text-sm font-medium">
                                    What would you like to discuss? *
                                </Label>
                                <Textarea
                                    id="concern"
                                    placeholder="I've been struggling with... I want to work on..."
                                    value={concernSummary}
                                    onChange={(e) => setConcernSummary(e.target.value)}
                                    className="min-h-[120px]"
                                    maxLength={1000}
                                />
                                <p className="text-xs text-muted-foreground text-right">
                                    {concernSummary.length}/1000
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="times" className="text-sm font-medium">
                                    Preferred Times (Optional)
                                </Label>
                                <Textarea
                                    id="times"
                                    placeholder="Weekday evenings after 6 PM, Saturday morning..."
                                    value={preferredTimes}
                                    onChange={(e) => setPreferredTimes(e.target.value)}
                                    className="min-h-[80px]"
                                    maxLength={500}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="notes" className="text-sm font-medium">
                                    Anything else? (Optional)
                                </Label>
                                <Textarea
                                    id="notes"
                                    placeholder="Any preferences for the session format, language, etc."
                                    value={additionalNotes}
                                    onChange={(e) => setAdditionalNotes(e.target.value)}
                                    className="min-h-[80px]"
                                    maxLength={500}
                                />
                            </div>
                        </div>

                        <Button
                            onClick={handleSubmit}
                            disabled={submitting || !concernSummary.trim()}
                            className="w-full"
                            size="lg"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                <>
                                    <MessageCircle className="w-4 h-4 mr-2" />
                                    Submit Request
                                </>
                            )}
                        </Button>

                        <Card className="p-4 bg-muted/50">
                            <h3 className="font-medium mb-2">What happens next?</h3>
                            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                                <li>Our team reviews your request (within 48 hours)</li>
                                <li>We'll email you with session details</li>
                                <li>Join the video call at the scheduled time</li>
                            </ol>
                        </Card>
                    </Card>
                )}
            </div>
        </PremiumRouteGuard>
    );
}
