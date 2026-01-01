import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";

export const ThirtyDayCharts = () => {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    fetchThirtyDayData();
  }, []);

  const fetchThirtyDayData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: analyticsData } = await supabase
      .from('user_analytics_daily')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (analyticsData) {
      const formattedData = analyticsData.map(day => ({
        date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        xp: day.xp_earned,
        quests: day.quests_completed,
        timeSaved: day.time_saved_minutes
      }));
      setData(formattedData);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold mb-4">30-Day Trends</h2>
      <Tabs defaultValue="xp" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="xp">XP Earned</TabsTrigger>
          <TabsTrigger value="quests">Quests</TabsTrigger>
          <TabsTrigger value="time">Time Saved</TabsTrigger>
        </TabsList>

        <TabsContent value="xp" className="mt-4">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip />
              <Line type="monotone" dataKey="xp" stroke="hsl(var(--primary))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </TabsContent>

        <TabsContent value="quests" className="mt-4">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip />
              <Bar dataKey="quests" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </TabsContent>

        <TabsContent value="time" className="mt-4">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip />
              <Line type="monotone" dataKey="timeSaved" stroke="hsl(var(--accent))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </TabsContent>
      </Tabs>
    </Card>
  );
};
