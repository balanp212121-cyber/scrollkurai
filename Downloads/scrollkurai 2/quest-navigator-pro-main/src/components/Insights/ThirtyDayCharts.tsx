import { useEffect, useState, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";

// ============================================
// UNIFIED CHART CONFIGURATION
// Same config for mobile & desktop - only container changes
// ============================================
const CHART_CONFIG = {
  // Colors
  lineColor: "#a855f7",
  gridColor: "rgba(255,255,255,0.08)",
  axisColor: "#6b7280",

  // Line style
  strokeWidth: 2.5,
  dotRadius: 4,
  activeDotRadius: 6,
  curveType: "monotone" as const,

  // Grid
  gridDash: "3 3",

  // Margins (consistent across breakpoints)
  margin: { top: 20, right: 25, left: 5, bottom: 20 },
};

// ============================================
// CUSTOM TOOLTIP - Matches mobile exactly
// ============================================
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  const value = payload[0].value;
  const dataKey = payload[0].dataKey;
  const displayLabel = dataKey === 'xp' ? 'xp' : dataKey === 'quests' ? 'quests' : 'time';

  return (
    <div
      className="bg-white rounded-lg px-3 py-2 shadow-lg"
      style={{
        border: '1px solid rgba(0,0,0,0.1)',
        minWidth: '80px',
        textAlign: 'center',
      }}
    >
      <p className="text-sm font-medium text-gray-900">
        {displayLabel} : <span className="text-purple-600 font-bold">{value}</span>
      </p>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
export const ThirtyDayCharts = () => {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Memoized fetch function
  const fetchThirtyDayData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsLoading(false);
      return;
    }

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
        xp: day.xp_earned || 0,
        quests: day.quests_completed || 0,
        timeSaved: day.time_saved_minutes || 0
      }));
      setData(formattedData);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchThirtyDayData();
  }, [fetchThirtyDayData]);

  // Memoized chart components to prevent re-renders
  const xAxisProps = useMemo(() => ({
    dataKey: "date",
    tick: { fontSize: 11, fill: CHART_CONFIG.axisColor },
    tickLine: false,
    axisLine: { stroke: CHART_CONFIG.gridColor },
    dy: 10,
  }), []);

  const yAxisProps = useMemo(() => ({
    tick: { fontSize: 11, fill: CHART_CONFIG.axisColor },
    tickLine: false,
    axisLine: { stroke: CHART_CONFIG.gridColor },
    width: 35,
  }), []);

  const gridProps = useMemo(() => ({
    strokeDasharray: CHART_CONFIG.gridDash,
    stroke: CHART_CONFIG.gridColor,
    vertical: false,
  }), []);

  const lineProps = useMemo(() => ({
    type: CHART_CONFIG.curveType,
    stroke: CHART_CONFIG.lineColor,
    strokeWidth: CHART_CONFIG.strokeWidth,
    dot: {
      fill: CHART_CONFIG.lineColor,
      strokeWidth: 2,
      stroke: '#fff',
      r: CHART_CONFIG.dotRadius
    },
    activeDot: {
      r: CHART_CONFIG.activeDotRadius,
      fill: CHART_CONFIG.lineColor,
      strokeWidth: 3,
      stroke: '#fff'
    },
    connectNulls: true, // Ensure line connects all points
    isAnimationActive: true,
    animationDuration: 800,
  }), []);

  // Empty state or single point handling
  const hasEnoughData = data.length >= 2;

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-muted rounded w-1/3 mb-4"></div>
          <div className="h-[300px] bg-muted rounded"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-6">
      <h2 className="text-xl font-bold mb-4">30-Day Trends</h2>

      {/*
        RESPONSIVE CONTAINER STRATEGY:
        - Mobile: Full width
        - Desktop: Max 800px, centered
        - Maintains aspect ratio and visual parity
      */}
      <div className="w-full max-w-[800px] mx-auto">
        <Tabs defaultValue="xp" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4 bg-muted/40">
            <TabsTrigger
              value="xp"
              className="text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              XP Earned
            </TabsTrigger>
            <TabsTrigger
              value="quests"
              className="text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              Quests
            </TabsTrigger>
            <TabsTrigger
              value="time"
              className="text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              Time Saved
            </TabsTrigger>
          </TabsList>

          {/* Single data point message */}
          {!hasEnoughData && data.length === 1 && (
            <p className="text-center text-muted-foreground text-sm mb-2">
              Complete more quests to see your trend line! 📈
            </p>
          )}

          {/* XP Chart */}
          <TabsContent value="xp" className="mt-2">
            <div className="w-full aspect-[16/10] min-h-[250px] max-h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={CHART_CONFIG.margin}>
                  <CartesianGrid {...gridProps} />
                  <XAxis {...xAxisProps} />
                  <YAxis {...yAxisProps} />
                  <Tooltip content={<CustomTooltip />} cursor={false} />
                  <Line dataKey="xp" {...lineProps} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          {/* Quests Chart */}
          <TabsContent value="quests" className="mt-2">
            <div className="w-full aspect-[16/10] min-h-[250px] max-h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={CHART_CONFIG.margin}>
                  <CartesianGrid {...gridProps} />
                  <XAxis {...xAxisProps} />
                  <YAxis {...yAxisProps} />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: 'rgba(168, 85, 247, 0.08)' }}
                  />
                  <Bar
                    dataKey="quests"
                    fill={CHART_CONFIG.lineColor}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          {/* Time Saved Chart */}
          <TabsContent value="time" className="mt-2">
            <div className="w-full aspect-[16/10] min-h-[250px] max-h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={CHART_CONFIG.margin}>
                  <CartesianGrid {...gridProps} />
                  <XAxis {...xAxisProps} />
                  <YAxis {...yAxisProps} />
                  <Tooltip content={<CustomTooltip />} cursor={false} />
                  <Line dataKey="timeSaved" {...lineProps} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
};
