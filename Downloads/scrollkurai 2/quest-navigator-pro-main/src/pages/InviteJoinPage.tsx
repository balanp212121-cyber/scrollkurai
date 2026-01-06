import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, Users } from "lucide-react";
import { toast } from "sonner";

export default function InviteJoinPage() {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState("");
    const [teamInfo, setTeamInfo] = useState<{ name: string; type: string } | null>(null);

    useEffect(() => {
        if (token) {
            handleJoin();
        } else {
            setStatus('error');
            setMessage('Invalid invite link');
        }
    }, [token]);

    const handleJoin = async () => {
        try {
            // Check if user is authenticated
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                // Store token in session storage and redirect to login
                sessionStorage.setItem('pendingInviteToken', token!);
                toast.info("Please sign in to accept the invite");
                navigate('/auth');
                return;
            }

            // Call the Edge Function
            const { data, error } = await supabase.functions.invoke('join-via-invite', {
                body: { token }
            });

            if (error) {
                throw new Error(error.message || 'Failed to join');
            }

            if (data?.error) {
                throw new Error(data.error);
            }

            setStatus('success');
            setMessage(data.message || 'Successfully joined!');
            setTeamInfo({
                name: data.team_name,
                type: data.team_type
            });

            toast.success(data.message);

            // Redirect to challenges page after 2 seconds
            setTimeout(() => {
                navigate('/challenges');
            }, 2000);

        } catch (error: any) {
            console.error('Join error:', error);
            setStatus('error');
            setMessage(error.message || 'Failed to join team');
            toast.error(error.message || 'Failed to join team');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="flex justify-center mb-4">
                        {status === 'loading' && (
                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            </div>
                        )}
                        {status === 'success' && (
                            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                                <CheckCircle className="w-8 h-8 text-green-500" />
                            </div>
                        )}
                        {status === 'error' && (
                            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                                <XCircle className="w-8 h-8 text-red-500" />
                            </div>
                        )}
                    </div>
                    <CardTitle>
                        {status === 'loading' && 'Joining...'}
                        {status === 'success' && 'Welcome!'}
                        {status === 'error' && 'Unable to Join'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                    <p className="text-muted-foreground">{message}</p>

                    {status === 'success' && teamInfo && (
                        <div className="flex items-center justify-center gap-2 p-3 bg-primary/10 rounded-lg">
                            <Users className="w-5 h-5 text-primary" />
                            <span className="font-medium">
                                {teamInfo.type === 'duo' ? 'Duo' : 'Team'}: {teamInfo.name}
                            </span>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="space-y-2">
                            <Button onClick={() => navigate('/challenges')} className="w-full">
                                Go to Challenges
                            </Button>
                            <Button variant="outline" onClick={() => navigate('/')} className="w-full">
                                Go Home
                            </Button>
                        </div>
                    )}

                    {status === 'success' && (
                        <p className="text-sm text-muted-foreground">
                            Redirecting to challenges...
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
