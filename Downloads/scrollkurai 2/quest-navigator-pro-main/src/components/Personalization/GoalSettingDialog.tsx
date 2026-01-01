import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Target } from "lucide-react";

interface GoalSettingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGoalCreated: () => void;
}

export const GoalSettingDialog = ({ open, onOpenChange, onGoalCreated }: GoalSettingDialogProps) => {
  const [goalType, setGoalType] = useState<string>("");
  const [targetApp, setTargetApp] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [currentBaseline, setCurrentBaseline] = useState("");
  const [creating, setCreating] = useState(false);

  const goalTypes = [
    { value: "reduce_app", label: "Reduce Specific App Usage" },
    { value: "screen_time_limit", label: "Daily Screen Time Limit" },
    { value: "productivity", label: "Increase Productivity Time" },
    { value: "social_media", label: "Reduce Social Media" },
    { value: "custom", label: "Custom Goal" }
  ];

  const handleCreateGoal = async () => {
    if (!goalType || !targetValue) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (goalType === "reduce_app" && !targetApp) {
      toast.error("Please specify which app to reduce");
      return;
    }

    setCreating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("user_goals").insert({
        user_id: user.id,
        goal_type: goalType,
        target_app: goalType === "reduce_app" ? targetApp : null,
        target_value: parseInt(targetValue),
        current_baseline: currentBaseline ? parseInt(currentBaseline) : null,
        is_active: true,
        progress: 0
      });

      if (error) throw error;

      toast.success("Goal created! Generating personalized quests...", {
        description: "AI is analyzing your goal to create tailored challenges"
      });

      onGoalCreated();
      onOpenChange(false);
      
      // Reset form
      setGoalType("");
      setTargetApp("");
      setTargetValue("");
      setCurrentBaseline("");

    } catch (error) {
      console.error("Error creating goal:", error);
      toast.error("Failed to create goal");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-5 w-5 text-primary" />
            <DialogTitle>Set Your Goal</DialogTitle>
          </div>
          <DialogDescription>
            Tell us what you want to achieve. Our AI will generate personalized quests to help you reach your goal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="goal-type">Goal Type</Label>
            <Select value={goalType} onValueChange={setGoalType}>
              <SelectTrigger id="goal-type">
                <SelectValue placeholder="Select a goal type" />
              </SelectTrigger>
              <SelectContent>
                {goalTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {goalType === "reduce_app" && (
            <div className="space-y-2">
              <Label htmlFor="target-app">Which App?</Label>
              <Input
                id="target-app"
                placeholder="e.g., Instagram, TikTok, YouTube"
                value={targetApp}
                onChange={(e) => setTargetApp(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter the name of the app you want to reduce
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="target-value">
              Target {goalType === "reduce_app" ? "Reduction" : "Limit"} (minutes per day)
            </Label>
            <Input
              id="target-value"
              type="number"
              placeholder="e.g., 60"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {goalType === "reduce_app" 
                ? "How many minutes do you want to reduce per day?" 
                : "What's your daily target in minutes?"}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="current-baseline">Current Usage (optional)</Label>
            <Input
              id="current-baseline"
              type="number"
              placeholder="e.g., 180"
              value={currentBaseline}
              onChange={(e) => setCurrentBaseline(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Your current daily usage in minutes (helps us personalize better)
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateGoal}
            disabled={creating || !goalType || !targetValue}
            className="flex-1"
          >
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Goal"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};