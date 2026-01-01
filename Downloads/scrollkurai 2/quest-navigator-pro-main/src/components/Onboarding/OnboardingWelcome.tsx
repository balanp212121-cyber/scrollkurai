import { Button } from "@/components/ui/button";
import { Sparkles, Zap, Target } from "lucide-react";

interface OnboardingWelcomeProps {
  onNext: () => void;
}

export const OnboardingWelcome = ({ onNext }: OnboardingWelcomeProps) => {
  return (
    <div className="p-8 space-y-6">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
        </div>
        
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Transform Brain Rot into True Potential
        </h1>
        
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          Join thousands who are reclaiming their time, focus, and mental clarity through gamified challenges.
        </p>
      </div>

      <div className="grid gap-4 max-w-lg mx-auto">
        <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
          <Zap className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold">Daily Quests</h3>
            <p className="text-sm text-muted-foreground">Complete challenges to earn XP and level up</p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
          <Target className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold">Track Progress</h3>
            <p className="text-sm text-muted-foreground">See your growth with detailed analytics</p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
          <Sparkles className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold">Compete & Win</h3>
            <p className="text-sm text-muted-foreground">Join leagues and earn exclusive badges</p>
          </div>
        </div>
      </div>

      <div className="flex justify-center pt-4">
        <Button onClick={onNext} size="lg" className="px-8">
          Get Started
        </Button>
      </div>
    </div>
  );
};
