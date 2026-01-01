import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, Moon, Flame, CreditCard, Sparkles } from "lucide-react";

interface NotificationPreferences {
    push_enabled: boolean;
    streak_reminders: boolean;
    purchase_alerts: boolean;
    positive_reinforcement: boolean;
    silent_start_hour: number;
    silent_end_hour: number;
}

export function NotificationPreferences() {
    const [preferences, setPreferences] = useState<NotificationPreferences>({
        push_enabled: true,
        streak_reminders: true,
        purchase_alerts: true,
        positive_reinforcement: true,
        silent_start_hour: 23,
        silent_end_hour: 7,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPreferences();
    }, []);

    const fetchPreferences = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from("notification_preferences")
                .select("*")
                .eq("user_id", user.id)
                .maybeSingle();

            if (data) {
                setPreferences(data);
            }
        } catch (error) {
            console.error("Error fetching preferences:", error);
        } finally {
            setLoading(false);
        }
    };

    const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const updated = { ...preferences, [key]: value };
            setPreferences(updated);

            const { error } = await supabase
                .from("notification_preferences")
                .upsert({
                    user_id: user.id,
                    ...updated,
                    updated_at: new Date().toISOString(),
                });

            if (error) throw error;
            toast.success("Preferences updated");
        } catch (error) {
            console.error("Error updating preferences:", error);
            toast.error("Failed to update preferences");
        }
    };

    if (loading) {
        return (
            <Card className="p-4">
                <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-muted rounded w-1/3" />
                    <div className="h-8 bg-muted rounded" />
                </div>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Notification Preferences
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Master Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                        <Bell className="w-5 h-5 text-primary" />
                        <div>
                            <Label className="font-medium">Push Notifications</Label>
                            <p className="text-xs text-muted-foreground">Enable all notifications</p>
                        </div>
                    </div>
                    <Switch
                        checked={preferences.push_enabled}
                        onCheckedChange={(v) => updatePreference("push_enabled", v)}
                    />
                </div>

                <div className="space-y-3 pl-2">
                    {/* Streak Reminders */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Flame className="w-4 h-4 text-orange-500" />
                            <div>
                                <Label className="text-sm">Streak Reminders</Label>
                                <p className="text-xs text-muted-foreground">Daily reminder to maintain streak</p>
                            </div>
                        </div>
                        <Switch
                            checked={preferences.streak_reminders}
                            onCheckedChange={(v) => updatePreference("streak_reminders", v)}
                            disabled={!preferences.push_enabled}
                        />
                    </div>

                    {/* Purchase Alerts */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <CreditCard className="w-4 h-4 text-green-500" />
                            <div>
                                <Label className="text-sm">Purchase Alerts</Label>
                                <p className="text-xs text-muted-foreground">Payment approval/failure notices</p>
                            </div>
                        </div>
                        <Switch
                            checked={preferences.purchase_alerts}
                            onCheckedChange={(v) => updatePreference("purchase_alerts", v)}
                            disabled={!preferences.push_enabled}
                        />
                    </div>

                    {/* Positive Reinforcement */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Sparkles className="w-4 h-4 text-purple-500" />
                            <div>
                                <Label className="text-sm">Encouragement</Label>
                                <p className="text-xs text-muted-foreground">Occasional positive messages (max 2/week)</p>
                            </div>
                        </div>
                        <Switch
                            checked={preferences.positive_reinforcement}
                            onCheckedChange={(v) => updatePreference("positive_reinforcement", v)}
                            disabled={!preferences.push_enabled}
                        />
                    </div>
                </div>

                {/* Silent Hours */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Moon className="w-5 h-5 text-indigo-500" />
                    <div>
                        <Label className="font-medium">Silent Hours</Label>
                        <p className="text-xs text-muted-foreground">
                            No notifications between 11 PM - 7 AM IST
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
