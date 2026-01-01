import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Sparkles, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ReflectionInsightsProps {
  questLogId: string;
}

interface Analysis {
  sentiment_score: number;
  insights: string;
  created_at: string;
}

export function ReflectionInsights({ questLogId }: ReflectionInsightsProps) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalysis();
  }, [questLogId]);

  const fetchAnalysis = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("reflections_analysis")
        .select("*")
        .eq("user_quest_log_id", questLogId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching analysis:", error);
        setLoading(false);
        return;
      }

      setAnalysis(data);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-4 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-16 w-full" />
        </div>
      </Card>
    );
  }

  if (!analysis) return null;

  const getSentimentColor = (score: number) => {
    if (score >= 8) return "text-green-400";
    if (score >= 5) return "text-accent";
    return "text-yellow-400";
  };

  return (
    <Card className="p-4 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20 animate-fade-in">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">AI Insights</h3>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className={`w-4 h-4 ${getSentimentColor(analysis.sentiment_score)}`} />
            <span className={`text-sm font-medium ${getSentimentColor(analysis.sentiment_score)}`}>
              {analysis.sentiment_score}/10
            </span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
          {analysis.insights}
        </p>
      </div>
    </Card>
  );
}
