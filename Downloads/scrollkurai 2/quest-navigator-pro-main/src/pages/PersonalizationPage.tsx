import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GoalSettingDialog } from "@/components/Personalization/GoalSettingDialog";
import { PersonalizedRecommendations } from "@/components/Personalization/PersonalizedRecommendations";
import { supabase } from "@/integrations/supabase/client";
import { Target, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface Goal {
  id: string;
  goal_type: string;
  target_app: string | null;
  target_value: number;
  current_baseline: number | null;
  progress: number;
  is_active: boolean;
  created_at: string;
}

export default function PersonalizationPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchGoals = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_goals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setGoals(data || []);
    } catch (error) {
      console.error("Error fetching goals:", error);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, [refreshKey]);

  const handleDeleteGoal = async (goalId: string) => {
    try {
      const { error } = await supabase
        .from("user_goals")
        .delete()
        .eq("id", goalId);

      if (error) throw error;

      toast.success("Goal deleted");
      fetchGoals();
    } catch (error) {
      console.error("Error deleting goal:", error);
      toast.error("Failed to delete goal");
    }
  };

  const handleToggleGoal = async (goalId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("user_goals")
        .update({ is_active: !isActive })
        .eq("id", goalId);

      if (error) throw error;

      toast.success(isActive ? "Goal paused" : "Goal activated");
      fetchGoals();
    } catch (error) {
      console.error("Error toggling goal:", error);
      toast.error("Failed to update goal");
    }
  };

  const formatGoalType = (type: string) => {
    return type.split("_").map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(" ");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">AI-Powered Goals</h2>
          <p className="text-muted-foreground mt-1">
            Set goals and get personalized quest recommendations
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Goal
        </Button>
      </div>

      {goals.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-5 w-5 text-primary" />
            <h3 className="text-xl font-bold">Your Goals</h3>
          </div>
          <div className="space-y-3">
            {goals.map((goal) => (
              <div
                key={goal.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold">
                      {formatGoalType(goal.goal_type)}
                    </h4>
                    {!goal.is_active && (
                      <Badge variant="outline" className="text-xs">Paused</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {goal.target_app && `${goal.target_app} • `}
                    Target: {goal.target_value} min/day
                    {goal.current_baseline && ` (from ${goal.current_baseline} min)`}
                  </p>
                  {goal.progress > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{goal.progress}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${Math.min(goal.progress, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleGoal(goal.id, goal.is_active)}
                  >
                    <CheckCircle2 className={`h-4 w-4 ${goal.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteGoal(goal.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <PersonalizedRecommendations 
        onRefresh={() => setRefreshKey(prev => prev + 1)} 
      />

      <GoalSettingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onGoalCreated={() => {
          fetchGoals();
          setRefreshKey(prev => prev + 1);
        }}
      />
    </div>
  );
}