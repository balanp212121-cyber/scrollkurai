import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Brain, AlertTriangle, Moon, Calendar, TrendingDown } from "lucide-react";

interface FailurePatterns {
    sunday_failure_rate: number;
    late_night_correlation: boolean;
    avg_streak_before_break: number;
    insights: string[];
}

export function FailurePatternsCard() {
    const [patterns, setPatterns] = useState<FailurePatterns | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPatterns();
    }, []);

    const fetchPatterns = async () => {
        try {
            const { data, error } = await (supabase.rpc as any)("get_failure_patterns");
            if (error) throw error;
            setPatterns(data);
        } catch (error) {
            console.error("Error fetching failure patterns:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Card className="p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-muted rounded w-1/3" />
                    <div className="h-20 bg-muted rounded" />
                </div>
            </Card>
        );
    }

    if (!patterns) return null;

    const validInsights = (patterns.insights || []).filter(Boolean);

    return (
        <Card className="border-amber-500/30">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-amber-500">
                    <Brain className="w-5 h-5" />
                    Self-Awareness Insights
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Key Metrics */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                        <Calendar className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
                        <p className="text-2xl font-bold">{patterns.sunday_failure_rate}%</p>
                        <p className="text-xs text-muted-foreground">Sunday failures</p>
                    </div>

                    <div className="text-center p-3 rounded-lg bg-muted/50">
                        <TrendingDown className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
                        <p className="text-2xl font-bold">{patterns.avg_streak_before_break || "—"}</p>
                        <p className="text-xs text-muted-foreground">Avg streak before break</p>
                    </div>

                    <div className="text-center p-3 rounded-lg bg-muted/50">
                        <Moon className={`w-5 h-5 mx-auto mb-1 ${patterns.late_night_correlation ? "text-amber-500" : "text-muted-foreground"}`} />
                        <p className="text-2xl font-bold">{patterns.late_night_correlation ? "⚠️" : "✓"}</p>
                        <p className="text-xs text-muted-foreground">Late-night risk</p>
                    </div>
                </div>

                {/* Insights */}
                {validInsights.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground">What's breaking your discipline?</h4>
                        {validInsights.map((insight, i) => (
                            <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                <p className="text-sm">{insight}</p>
                            </div>
                        ))}
                    </div>
                )}

                {validInsights.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground">
                        <p className="text-sm">Keep going! No major patterns detected yet.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
