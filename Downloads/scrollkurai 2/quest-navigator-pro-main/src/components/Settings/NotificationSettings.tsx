import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell } from "lucide-react";
import { toast } from "sonner";

interface NotificationPrefs {
  daily_quest_reminder: boolean;
  streak_reminder: boolean;
  friend_challenge: boolean;
  community_activity: boolean;
  notification_frequency: 'minimal' | 'normal' | 'frequent';
}

export function NotificationSettings() {
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    daily_quest_reminder: true,
    streak_reminder: true,
    friend_challenge: true,
    community_activity: true,
    notification_frequency: 'normal',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await (supabase as any)
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching preferences:', error);
        return;
      }

      if (data) {
        setPrefs({
          daily_quest_reminder: data.daily_quest_reminder,
          streak_reminder: data.streak_reminder,
          friend_challenge: data.friend_challenge,
          community_activity: data.community_activity,
          notification_frequency: data.notification_frequency || 'normal',
        });
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key: keyof NotificationPrefs, value: boolean | string) => {
    const newPrefs = { ...prefs, [key]: value };
    setPrefs(newPrefs);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await (supabase as any)
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          [key]: value,
        });

      if (error) throw error;

      toast.success('Notification settings updated');
    } catch (error) {
      console.error('Error updating preferences:', error);
      toast.error('Failed to update settings');
      // Revert on error
      setPrefs(prefs);
    }
  };

  if (loading) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">Loading settings...</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-card/50 border-primary/20">
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-lg">Push Notifications</h3>
        </div>

        <div className="space-y-4">
          <div className="pb-4 border-b">
            <div className="space-y-3">
              <Label htmlFor="frequency" className="text-sm font-semibold">
                Notification Frequency
              </Label>
              <Select
                value={prefs.notification_frequency}
                onValueChange={(value: 'minimal' | 'normal' | 'frequent') => 
                  updatePreference('notification_frequency', value)
                }
              >
                <SelectTrigger id="frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minimal">
                    Minimal - Only critical updates
                  </SelectItem>
                  <SelectItem value="normal">
                    Normal - Balanced notifications (recommended)
                  </SelectItem>
                  <SelectItem value="frequent">
                    Frequent - All updates
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {prefs.notification_frequency === 'minimal' && 
                  "Only quest completions, streak milestones, and theme unlocks (max 1 per 6 hours)"}
                {prefs.notification_frequency === 'normal' && 
                  "Well-timed notifications based on your activity (max 1 per 6 hours)"}
                {prefs.notification_frequency === 'frequent' && 
                  "All event notifications as they happen"}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="daily-quest">Daily Quest Reminder</Label>
              <p className="text-xs text-muted-foreground">
                Get reminded about your daily quest
              </p>
            </div>
            <Switch
              id="daily-quest"
              checked={prefs.daily_quest_reminder}
              onCheckedChange={(checked) => updatePreference('daily_quest_reminder', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="streak-reminder">Streak Reminder</Label>
              <p className="text-xs text-muted-foreground">
                Don't break your streak
              </p>
            </div>
            <Switch
              id="streak-reminder"
              checked={prefs.streak_reminder}
              onCheckedChange={(checked) => updatePreference('streak_reminder', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="friend-challenge">Friend Challenges</Label>
              <p className="text-xs text-muted-foreground">
                Get notified about challenge invites
              </p>
            </div>
            <Switch
              id="friend-challenge"
              checked={prefs.friend_challenge}
              onCheckedChange={(checked) => updatePreference('friend_challenge', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="community-activity">Community Activity</Label>
              <p className="text-xs text-muted-foreground">
                Likes and comments on your posts
              </p>
            </div>
            <Switch
              id="community-activity"
              checked={prefs.community_activity}
              onCheckedChange={(checked) => updatePreference('community_activity', checked)}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
