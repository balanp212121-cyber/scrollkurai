import { Button } from "@/components/ui/button";
import { Sparkles, Zap, Target } from "lucide-react";

interface OnboardingWelcomeProps {
  onNext: () => void;
}

export const OnboardingWelcome = ({ onNext }: OnboardingWelcomeProps) => {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-4 sm:space-y-6">
        <div className="text-center space-y-2 sm:space-y-4">
          <div className="flex justify-center">
            <div className="w-12 h-12 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles className="w-6 h-6 sm:w-10 sm:h-10 text-white" />
            </div>
          </div>

          <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent leading-tight mt-2">
            Transform Brain Rot into True Potential
          </h1>

          <p className="text-sm sm:text-lg text-muted-foreground max-w-md mx-auto leading-normal">
            Join thousands who are reclaiming their time, focus, and mental clarity through gamified challenges.
          </p>
        </div>

        <div className="grid gap-3 sm:gap-4 max-w-lg mx-auto">
          <div className="flex items-start gap-3 p-3 sm:p-4 rounded-lg bg-muted/50">
            <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0 mt-1" />
            <div className="text-left">
              <h3 className="font-semibold text-sm sm:text-base">Daily Quests</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">Complete challenges to earn XP and level up</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 sm:p-4 rounded-lg bg-muted/50">
            <Target className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0 mt-1" />
            <div className="text-left">
              <h3 className="font-semibold text-sm sm:text-base">Track Progress</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">See your growth with detailed analytics</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 sm:p-4 rounded-lg bg-muted/50">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0 mt-1" />
            <div className="text-left">
              <h3 className="font-semibold text-sm sm:text-base">Compete & Win</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">Join leagues and earn exclusive badges</p>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 flex-shrink-0 p-4 border-t bg-background/95 backdrop-blur z-10 pb-[calc(1rem_+_env(safe-area-inset-bottom,0px))] sm:pb-6">
        <Button onClick={onNext} size="lg" className="w-full text-base h-11 sm:h-12 shadow-lg hover:scale-[1.02] transition-transform">
          Get Started
        </Button>
      </div>
    </div>
  );
};
