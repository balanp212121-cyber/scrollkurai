import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Smartphone, Brain, Users, Clock } from "lucide-react";

interface OnboardingGoalSelectionProps {
  selectedGoal: string;
  onSelectGoal: (goal: string) => void;
  onNext: () => void;
}

const goals = [
  {
    id: "screentime",
    icon: Smartphone,
    title: "Reduce Screen Time",
    description: "Spend less time scrolling, more time living"
  },
  {
    id: "focus",
    icon: Brain,
    title: "Improve Focus",
    description: "Build better concentration and mental clarity"
  },
  {
    id: "social",
    icon: Users,
    title: "Break Social Media Habit",
    description: "Take control of your social media usage"
  },
  {
    id: "productivity",
    icon: Clock,
    title: "Boost Productivity",
    description: "Achieve more with your time each day"
  }
];

export const OnboardingGoalSelection = ({
  selectedGoal,
  onSelectGoal,
  onNext
}: OnboardingGoalSelectionProps) => {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold">What's Your Main Challenge?</h2>
          <p className="text-muted-foreground text-sm sm:text-base">
            Choose one to get personalized quests (or skip to explore on your own)
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
          {goals.map((goal) => {
            const Icon = goal.icon;
            return (
              <Card
                key={goal.id}
                className={`p-4 cursor-pointer transition-all hover:scale-105 ${selectedGoal === goal.id
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50"
                  }`}
                onClick={() => onSelectGoal(goal.id)}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${selectedGoal === goal.id ? "bg-primary/20" : "bg-muted"
                    }`}>
                    <Icon className={`w-6 h-6 ${selectedGoal === goal.id ? "text-primary" : "text-muted-foreground"
                      }`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{goal.title}</h3>
                    <p className="text-sm text-muted-foreground">{goal.description}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="sticky bottom-0 flex-shrink-0 p-4 border-t bg-background/95 backdrop-blur z-10 pb-[calc(1rem_+_env(safe-area-inset-bottom,0px))] sm:pb-6">
        <div className="flex justify-center gap-4">
          <Button
            variant="ghost"
            onClick={onNext}
            size="lg"
            className="flex-1 sm:flex-none"
          >
            Skip
          </Button>
          <Button
            onClick={onNext}
            size="lg"
            disabled={!selectedGoal}
            className="px-8 flex-[2] sm:flex-none"
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
};
