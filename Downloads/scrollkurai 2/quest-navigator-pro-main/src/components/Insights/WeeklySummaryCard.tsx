import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Trophy, Zap, Flame, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const WeeklySummaryCard = () => {
  const [weeklyStats, setWeeklyStats] = useState({
    xp: 0,
    quests: 0,
    streak: 0,
    timeSaved: 0
  });

  useEffect(() => {
    fetchWeeklyStats();
  }, []);

  const fetchWeeklyStats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data } = await supabase
      .from('user_analytics_daily')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', sevenDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (data && data.length > 0) {
      const totalXp = data.reduce((sum, day) => sum + day.xp_earned, 0);
      const totalQuests = data.reduce((sum, day) => sum + day.quests_completed, 0);
      const totalTime = data.reduce((sum, day) => sum + day.time_saved_minutes, 0);
      const currentStreak = data[0]?.streak || 0;

      setWeeklyStats({
        xp: totalXp,
        quests: totalQuests,
        streak: currentStreak,
        timeSaved: totalTime
      });
    }
  };

  const stats = [
    { icon: Zap, label: "XP Earned", value: weeklyStats.xp, color: "text-yellow-500" },
    { icon: Trophy, label: "Quests Done", value: weeklyStats.quests, color: "text-blue-500" },
    { icon: Flame, label: "Current Streak", value: `${weeklyStats.streak} days`, color: "text-orange-500" },
    { icon: Clock, label: "Time Saved", value: `${Math.floor(weeklyStats.timeSaved / 60)}h`, color: "text-green-500" }
  ];

  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold mb-4">This Week</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="text-center space-y-2">
              <div className="flex justify-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
