import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Gift, Users, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

export function ReferralDashboard() {
    const [referralCode, setReferralCode] = useState("");
    const [stats, setStats] = useState({
        totalReferred: 0,
        completedDay1: 0,
        pending: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchReferralData();
    }, []);

    const fetchReferralData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Code is just username for now (simple V1)
            const { data: profile } = await supabase
                .from('profiles')
                .select('username')
                .eq('id', user.id)
                .single();

            if (profile) setReferralCode(profile.username);

            // Fetch stats
            // First get total count
            const { count, error } = await supabase
                .from('referrals')
                .select('*', { count: 'exact', head: true })
                .eq('referrer_id', user.id);

            // Since we can't count easily with select * in js client without downloading all rows if large, 
            // we'll assume user has < 1000 referrals for V1.
            // A better way is .select('*', { count: 'exact', head: true }) for counts, but we need status breakdown.

            const { data: referrals } = await supabase
                .from('referrals')
                .select('status')
                .eq('referrer_id', user.id);

            if (referrals) {
                const completed = referrals.filter(r => r.status === 'day_1_completed' || r.status === 'completed').length;
                const pending = referrals.length - completed;
                setStats({
                    totalReferred: referrals.length,
                    completedDay1: completed,
                    pending
                });
            }

        } catch (e) {
            console.error("Error fetching referrals:", e);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        // In production, this would be a full URL like `https://scrollkurai.com?ref=${referralCode}`
        const link = `https://scrollkurai.com/signup?ref=${referralCode}`;
        navigator.clipboard.writeText(link);
        toast.success("Referral link copied!");
    };

    const NEXT_REWARD_AT = 5;
    const progress = Math.min((stats.completedDay1 / NEXT_REWARD_AT) * 100, 100);

    return (
        <div className="space-y-6">
            <Card className="bg-gradient-to-br from-primary/10 to-accent/5 border-primary/20">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Gift className="w-5 h-5 text-primary" />
                        Invite Friends, Get Pro
                    </CardTitle>
                    <CardDescription>
                        Get 1 week of ScrollKurai Pro for every 5 friends who complete their first quest.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2 mb-6">
                        <Input value={`https://scrollkurai.com/signup?ref=${referralCode || '...'}`} readOnly className="bg-background/50" />
                        <Button onClick={copyToClipboard} size="icon" variant="outline"><Copy className="w-4 h-4" /></Button>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>Progress to next reward</span>
                            <span className="font-bold text-primary">{stats.completedDay1} / {NEXT_REWARD_AT} Friends</span>
                        </div>
                        <Progress value={progress} className="h-3" />
                        <p className="text-xs text-muted-foreground mt-1">
                            Only friends who complete "Day 1" quest count toward rewards.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
                <Card>
                    <CardContent className="pt-6 text-center">
                        <Users className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                        <div className="text-2xl font-bold">{stats.totalReferred}</div>
                        <p className="text-xs text-muted-foreground">Total Invites</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6 text-center">
                        <Trophy className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                        <div className="text-2xl font-bold">{Math.floor(stats.completedDay1 / 5)}</div>
                        <p className="text-xs text-muted-foreground">Weeks of Pro Earned</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
