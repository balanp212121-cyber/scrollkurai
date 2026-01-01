import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, AlertTriangle, CheckCircle, Activity } from "lucide-react";

export function SystemHealthPanel() {
    const { data: healthStats, isLoading } = useQuery({
        queryKey: ["admin-system-health"],
        queryFn: async () => {
            // For now, we just check if there are any failed events in the last 24h
            const { count: failedCount, error } = await supabase
                .from("events")
                .select("*", { count: 'exact', head: true })
                .eq("status", "failed")
                .gt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

            if (error) throw error;

            const { count: pendingCount } = await supabase
                .from("events")
                .select("*", { count: 'exact', head: true })
                .eq("status", "pending");

            return {
                failedEvents24h: failedCount || 0,
                pendingEvents: pendingCount || 0,
                status: failedCount === 0 ? 'healthy' : 'degraded'
            };
        },
        refetchInterval: 60000
    });

    if (isLoading) {
        return <div className="text-center p-8"><Loader2 className="animate-spin mx-auto" /></div>;
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className={healthStats?.status === 'healthy' ? "border-green-500/50 bg-green-500/5" : "border-red-500/50 bg-red-500/5"}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">System Status</CardTitle>
                    <Activity className={healthStats?.status === 'healthy' ? "text-green-500" : "text-red-500"} />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold uppercase">{healthStats?.status}</div>
                    <p className="text-xs text-muted-foreground">Overall Platform Health</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Failed Events (24h)</CardTitle>
                    <AlertTriangle className="text-yellow-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{healthStats?.failedEvents24h}</div>
                    <p className="text-xs text-muted-foreground">Async tasks that errored</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Pending Queue</CardTitle>
                    <CheckCircle className="text-blue-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{healthStats?.pendingEvents}</div>
                    <p className="text-xs text-muted-foreground">Events waiting to process</p>
                </CardContent>
            </Card>
        </div>
    );
}
