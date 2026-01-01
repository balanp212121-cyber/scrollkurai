import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { History, RefreshCw, Loader2, Shield, AlertTriangle, CheckCircle, XCircle, MessageCircle } from "lucide-react";
import { format } from "date-fns";

/**
 * ADMIN AUDIT LOG VIEWER
 * ======================
 * Purpose: Read-only view of high-impact admin actions
 * 
 * DESIGN DECISIONS:
 * - Last 100 entries only (performance at scale)
 * - No filters initially (KISS principle)
 * - Read-only (append-only table has no UPDATE/DELETE policies)
 * - Fire-and-forget logging never blocks main actions
 * 
 * LOGGED ACTIONS:
 * - role_change: Admin role modifications
 * - streak_restore: Manual streak restorations
 * - payment_approve/payment_reject: Payment proof decisions
 * - counselling_confirm/counselling_decline: Counselling moderation
 */

interface AuditLogEntry {
    id: string;
    admin_user_id: string;
    action: string;
    target_type: string;
    target_id: string | null;
    metadata: Record<string, any>;
    created_at: string;
    admin_username?: string;
}

const ACTION_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    payment_approve: {
        label: "Payment Approved",
        icon: <CheckCircle className="w-4 h-4" />,
        color: "bg-green-500/20 text-green-500 border-green-500/30"
    },
    payment_reject: {
        label: "Payment Rejected",
        icon: <XCircle className="w-4 h-4" />,
        color: "bg-red-500/20 text-red-500 border-red-500/30"
    },
    counselling_confirm: {
        label: "Counselling Confirmed",
        icon: <MessageCircle className="w-4 h-4" />,
        color: "bg-green-500/20 text-green-500 border-green-500/30"
    },
    counselling_decline: {
        label: "Counselling Declined",
        icon: <XCircle className="w-4 h-4" />,
        color: "bg-orange-500/20 text-orange-500 border-orange-500/30"
    },
    role_change: {
        label: "Role Changed",
        icon: <Shield className="w-4 h-4" />,
        color: "bg-purple-500/20 text-purple-500 border-purple-500/30"
    },
    streak_restore: {
        label: "Streak Restored",
        icon: <AlertTriangle className="w-4 h-4" />,
        color: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30"
    },
};

export function AdminAuditLogViewer() {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);

        try {
            // Fetch last 100 audit logs
            const { data, error } = await (supabase as any)
                .from('admin_audit_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;

            // Get admin usernames
            if (data && data.length > 0) {
                const adminIds: string[] = [...new Set(data.map((log: AuditLogEntry) => log.admin_user_id))];
                const { data: profiles } = await supabase.rpc('get_profiles_by_ids_admin', {
                    user_ids: adminIds
                });

                const usernameMap = new Map(profiles?.map((p: any) => [p.id, p.username]) || []);

                setLogs(data.map((log: AuditLogEntry) => ({
                    ...log,
                    admin_username: usernameMap.get(log.admin_user_id) || 'Unknown'
                })));
            } else {
                setLogs([]);
            }

            if (silent) toast.success("Audit logs refreshed");
        } catch (error) {
            console.error('Error fetching audit logs:', error);
            if (!silent) toast.error("Failed to load audit logs");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const getActionConfig = (action: string) => {
        return ACTION_CONFIG[action] || {
            label: action,
            icon: <History className="w-4 h-4" />,
            color: "bg-muted text-muted-foreground"
        };
    };

    if (loading) {
        return (
            <Card className="p-8">
                <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Loading audit logs...</span>
                </div>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <History className="w-5 h-5" />
                        Admin Audit Log
                    </CardTitle>
                    <CardDescription>
                        Last 100 high-impact admin actions (read-only)
                    </CardDescription>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchLogs(true)}
                    disabled={refreshing}
                >
                    <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </CardHeader>
            <CardContent>
                {logs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No audit logs recorded yet</p>
                        <p className="text-sm">Actions will appear here after migration is applied</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Admin</TableHead>
                                    <TableHead>Action</TableHead>
                                    <TableHead>Target</TableHead>
                                    <TableHead>Details</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.map((log) => {
                                    const config = getActionConfig(log.action);
                                    return (
                                        <TableRow key={log.id}>
                                            <TableCell className="text-xs font-mono whitespace-nowrap">
                                                {format(new Date(log.created_at), "MMM d, HH:mm")}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {log.admin_username}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={`gap-1 ${config.color}`}>
                                                    {config.icon}
                                                    {config.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {log.target_type}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                                                {log.metadata?.item || log.metadata?.reason || log.metadata?.scheduled_for || '-'}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
