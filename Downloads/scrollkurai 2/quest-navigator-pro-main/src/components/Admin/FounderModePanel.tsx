import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
    Shield, RefreshCw, Zap, Ban, Trophy,
    Calendar, History, Loader2, AlertTriangle
} from "lucide-react";

interface AdminAction {
    id: string;
    action_type: string;
    target_type: string;
    target_id: string;
    reason: string;
    created_at: string;
    admin_id: string;
}

interface Team {
    id: string;
    name: string;
}

export function FounderModePanel() {
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [actions, setActions] = useState<AdminAction[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectedTeam, setSelectedTeam] = useState<string>('');
    const [xpAdjustment, setXpAdjustment] = useState<number>(0);
    const [reason, setReason] = useState<string>('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        checkAdminStatus();
    }, []);

    const checkAdminStatus = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            const { data: roles } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', user.id)
                .eq('role', 'admin')
                .single();

            setIsAdmin(!!roles);

            if (roles) {
                fetchData();
            }
        } catch (error) {
            console.error('Error checking admin status:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchData = async () => {
        // Fetch teams
        const { data: teamsData } = await supabase
            .from('teams')
            .select('id, name')
            .order('name');
        setTeams(teamsData || []);

        // Fetch recent admin actions
        const { data: actionsData } = await supabase
            .from('admin_actions_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
        setActions(actionsData || []);
    };

    const recalculateLeaderboard = async () => {
        setProcessing(true);
        try {
            const { data, error } = await supabase.rpc('recalculate_team_leaderboard');
            if (error) throw error;
            toast.success(`Leaderboard recalculated! ${data?.teams_ranked || 0} teams ranked.`);
            fetchData();
        } catch (error) {
            console.error('Error recalculating:', error);
            toast.error('Failed to recalculate leaderboard');
        } finally {
            setProcessing(false);
        }
    };

    const executeOverride = async (actionType: string, newValue?: any) => {
        if (!selectedTeam) {
            toast.error('Please select a team');
            return;
        }
        if (reason.length < 10) {
            toast.error('Reason must be at least 10 characters');
            return;
        }

        setProcessing(true);
        try {
            const { data, error } = await supabase.rpc('admin_override', {
                p_action_type: actionType,
                p_target_type: 'team',
                p_target_id: selectedTeam,
                p_new_value: newValue || {},
                p_reason: reason
            });

            if (error) throw error;
            if (!data?.success) throw new Error(data?.error);

            toast.success(`${actionType} executed successfully`);
            setReason('');
            setXpAdjustment(0);
            fetchData();
        } catch (error: any) {
            console.error('Error executing override:', error);
            toast.error(error.message || 'Failed to execute override');
        } finally {
            setProcessing(false);
        }
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

    if (!isAdmin) {
        return (
            <Card className="p-8 text-center">
                <Shield className="h-12 w-12 text-red-500 mx-auto mb-3" />
                <h2 className="text-xl font-bold text-red-500">Access Denied</h2>
                <p className="text-muted-foreground mt-2">Founder Mode requires admin privileges.</p>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <Card className="p-4 bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-500/20">
                <div className="flex items-center gap-3">
                    <Shield className="h-6 w-6 text-red-500" />
                    <div>
                        <h2 className="font-bold text-lg">Founder Mode</h2>
                        <p className="text-sm text-muted-foreground">
                            Admin overrides are logged and auditable
                        </p>
                    </div>
                </div>
            </Card>

            <Tabs defaultValue="actions" className="space-y-4">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="actions">Quick Actions</TabsTrigger>
                    <TabsTrigger value="overrides">Team Overrides</TabsTrigger>
                    <TabsTrigger value="history">Audit Log</TabsTrigger>
                </TabsList>

                {/* Quick Actions */}
                <TabsContent value="actions" className="space-y-4">
                    <Card className="p-4">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <RefreshCw className="h-4 w-4" />
                            System Actions
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <Button
                                onClick={recalculateLeaderboard}
                                disabled={processing}
                                className="w-full"
                            >
                                {processing ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                )}
                                Recalculate Leaderboard
                            </Button>
                            <Button variant="outline" className="w-full">
                                <Trophy className="h-4 w-4 mr-2" />
                                End Current Season
                            </Button>
                        </div>
                    </Card>
                </TabsContent>

                {/* Team Overrides */}
                <TabsContent value="overrides" className="space-y-4">
                    <Card className="p-4">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            Team Overrides
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium">Select Team</label>
                                <select
                                    className="w-full mt-1 p-2 border rounded-md bg-background"
                                    value={selectedTeam}
                                    onChange={(e) => setSelectedTeam(e.target.value)}
                                >
                                    <option value="">Choose a team...</option>
                                    {teams.map(team => (
                                        <option key={team.id} value={team.id}>{team.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-sm font-medium">Reason (Required)</label>
                                <Textarea
                                    placeholder="Explain why this override is necessary (min 10 chars)..."
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="mt-1"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium">XP Adjustment</label>
                                    <Input
                                        type="number"
                                        placeholder="e.g. -500 or 100"
                                        value={xpAdjustment}
                                        onChange={(e) => setXpAdjustment(Number(e.target.value))}
                                        className="mt-1"
                                    />
                                </div>
                                <Button
                                    onClick={() => executeOverride('ADJUST_TEAM_XP', { total_xp: xpAdjustment })}
                                    disabled={processing || !selectedTeam}
                                    className="mt-6"
                                >
                                    <Zap className="h-4 w-4 mr-2" />
                                    Adjust XP
                                </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                                <Button
                                    variant="outline"
                                    onClick={() => executeOverride('RESET_TEAM_STREAK')}
                                    disabled={processing || !selectedTeam}
                                >
                                    Reset Streak
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={() => executeOverride('DISQUALIFY_TEAM')}
                                    disabled={processing || !selectedTeam}
                                >
                                    <Ban className="h-4 w-4 mr-2" />
                                    Disqualify
                                </Button>
                            </div>
                        </div>
                    </Card>
                </TabsContent>

                {/* Audit Log */}
                <TabsContent value="history">
                    <Card>
                        <div className="p-4 border-b">
                            <h3 className="font-semibold flex items-center gap-2">
                                <History className="h-4 w-4" />
                                Admin Actions History
                            </h3>
                        </div>
                        <ScrollArea className="h-[400px]">
                            {actions.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground">
                                    No admin actions recorded yet
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {actions.map((action) => (
                                        <div key={action.id} className="p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <Badge variant="outline">{action.action_type}</Badge>
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(action.created_at).toLocaleString()}
                                                </span>
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                {action.reason}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
