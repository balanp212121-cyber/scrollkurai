import { useEffect, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, Zap } from 'lucide-react';

type PowerUpTimelineItem = {
    powerup_id: string;
    powerup_name: string;
    activated_at: string;
    expires_at: string;
    cooldown_until: string;
    state: 'active' | 'cooldown' | 'available';
};

export function PowerUpTimeline() {
    const [items, setItems] = useState<PowerUpTimelineItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTimeline();
        // Poll every minute
        const interval = setInterval(fetchTimeline, 60000);
        return () => clearInterval(interval);
    }, []);

    async function fetchTimeline() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from('powerup_state_view')
            .select('*')
            .order('activated_at', { ascending: false });

        if (error) {
            console.error('Error fetching timeline:', error);
        } else {
            setItems(data as PowerUpTimelineItem[]);
        }
        setLoading(false);
    }

    if (loading) return <div>Loading timeline...</div>;
    if (items.length === 0) return <div>No power-up history.</div>;

    const getTimeLeft = (target: string) => {
        const diff = new Date(target).getTime() - Date.now();
        if (diff <= 0) return '0m';
        const mins = Math.ceil(diff / 60000);
        const hours = Math.floor(mins / 60);
        if (hours > 0) return `${hours}h ${mins % 60}m`;
        return `${mins}m`;
    };

    const getProgress = (start: string, end: string) => {
        const total = new Date(end).getTime() - new Date(start).getTime();
        const elapsed = Date.now() - new Date(start).getTime();
        const percent = (elapsed / total) * 100;
        return Math.min(Math.max(percent, 0), 100);
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    Power-Up Timeline
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {items.map((item) => (
                    <div key={item.powerup_id + item.activated_at} className="border p-3 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-bold">{item.powerup_name}</span>
                            <Badge variant={item.state === 'active' ? 'default' : item.state === 'cooldown' ? 'secondary' : 'outline'}>
                                {item.state.toUpperCase()}
                            </Badge>
                        </div>

                        {item.state === 'active' && (
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Active</span>
                                    <span>Expires in {getTimeLeft(item.expires_at)}</span>
                                </div>
                                <Progress value={getProgress(item.activated_at, item.expires_at)} className="h-2" />
                            </div>
                        )}

                        {item.state === 'cooldown' && (
                            <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
                                <Clock className="h-4 w-4" />
                                <span>Cooling down: Available in {getTimeLeft(item.cooldown_until)}</span>
                            </div>
                        )}

                        {item.state === 'available' && (
                            <div className="text-sm text-green-600 mt-2">
                                Ready to activate!
                            </div>
                        )}
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
