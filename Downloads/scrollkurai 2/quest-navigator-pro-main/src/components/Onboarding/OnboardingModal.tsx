import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { OnboardingWelcome } from "./OnboardingWelcome";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { OnboardingGoalSelection } from "./OnboardingGoalSelection";
import { OnboardingFirstQuest } from "./OnboardingFirstQuest";
import { OnboardingInvite } from "./OnboardingInvite";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import confetti from "canvas-confetti";

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export const OnboardingModal = ({ isOpen, onComplete }: OnboardingModalProps) => {
  const [currentStep, setCurrentStep] = useState<'welcome' | 'goal' | 'quest' | 'invite'>('welcome');
  const [selectedGoal, setSelectedGoal] = useState<string>("");
  const [initialized, setInitialized] = useState(false);
  const navigate = useNavigate();

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep('welcome');
      setSelectedGoal("");
      setInitialized(false);
    }
  }, [isOpen]);

  // Restore progress if user refreshes mid-onboarding
  useEffect(() => {
    if (isOpen && !initialized) {
      restoreProgress();
    }
  }, [isOpen, initialized]);

  const restoreProgress = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: progress } = await supabase
      .from('onboarding_progress')
      .select('step_completed')
      .eq('user_id', user.id)
      .maybeSingle();

    if (progress?.step_completed && progress.step_completed !== 'welcome') {
      setCurrentStep(progress.step_completed as any);
    }
    setInitialized(true);
  };

  const handleNext = async (step: 'welcome' | 'goal' | 'quest' | 'invite') => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Save progress incrementally
      await supabase.from('onboarding_progress').upsert({
        user_id: user.id,
        step_completed: step,
        updated_at: new Date().toISOString(),
      });
    }
    setCurrentStep(step);
  };

  const handleSkipInvite = async () => {
    await completeOnboarding(true);
  };

  const handleCompleteInvite = async () => {
    await completeOnboarding(false);
  };

  const completeOnboarding = async (skipped: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      // Save selected goal to user_goals table if one was selected
      if (selectedGoal) {
        const { error: goalError } = await supabase.from('user_goals').insert({
          user_id: user.id,
          goal_type: selectedGoal,
          target_value: 60, // Default 60 minutes reduction
          is_active: true,
        });
        if (goalError) console.error('Error saving goal:', goalError);
      }

      // Get the Welcome Warrior badge
      const { data: badge } = await supabase
        .from('badges')
        .select('id')
        .eq('name', 'Welcome Warrior')
        .maybeSingle();

      // Award the badge if not already earned
      if (badge) {
        // Check if user already has this badge
        const { data: existingBadge } = await supabase
          .from('user_badges')
          .select('id')
          .eq('user_id', user.id)
          .eq('badge_id', badge.id)
          .maybeSingle();

        if (!existingBadge) {
          const { error: badgeError } = await supabase.from('user_badges').insert({
            user_id: user.id,
            badge_id: badge.id,
          });
          if (badgeError) console.error('Error awarding badge:', badgeError);
        }
      }

      // Update profile with bonus XP
      const { data: profile } = await supabase
        .from('profiles')
        .select('xp')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        await supabase
          .from('profiles')
          .update({ xp: profile.xp + 100 })
          .eq('id', user.id);
      }

      // Mark onboarding as complete - CRITICAL: Must complete before navigation
      const { error: progressError } = await supabase
        .from('onboarding_progress')
        .upsert({
          user_id: user.id,
          step_completed: 'invite',
          completed_at: new Date().toISOString(),
          skipped,
        }, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        });

      if (progressError) {
        console.error('Error marking onboarding complete:', progressError);
        // Don't throw - still allow completion to prevent repeat onboarding
      }

      // CRITICAL: Wait for DB write to complete before proceeding
      // Verify completion was persisted
      let verifyAttempts = 0;
      const maxAttempts = 3;
      let verified = false;

      while (verifyAttempts < maxAttempts && !verified) {
        const { data: verifyProgress } = await supabase
          .from('onboarding_progress')
          .select('completed_at')
          .eq('user_id', user.id)
          .maybeSingle();

        if (verifyProgress?.completed_at) {
          verified = true;
          console.log('Onboarding completion verified:', verifyProgress.completed_at);
        } else {
          verifyAttempts++;
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (!verified) {
        console.warn('Could not verify onboarding completion, but proceeding');
      }

      // Set localStorage flag to prevent re-showing onboarding
      localStorage.setItem(`onboarding_completed_${user.id}`, 'true');

      // Celebrate with confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      // Show success message
      toast.success("🎉 Welcome Warrior Badge Unlocked!", {
        description: "You've earned 100 bonus XP for completing onboarding!",
        duration: 4000,
      });

      // Set flag to show quest highlight on dashboard
      if (!skipped) {
        localStorage.setItem('just_completed_onboarding', 'true');
      }

      // Set flag to trigger tutorial tour immediately (with null check)
      if (user?.id) {
        localStorage.setItem(`tutorial_trigger_${user.id}`, 'true');
        localStorage.removeItem(`tutorial_completed_${user.id}`);
        localStorage.removeItem(`tutorial_shown_${user.id}`);
      }

      // Close modal first
      onComplete();

      // Navigate after verified completion
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 500);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      // Still mark as complete to prevent repeat onboarding
      await supabase
        .from('onboarding_progress')
        .upsert({
          user_id: user.id,
          step_completed: 'invite',
          completed_at: new Date().toISOString(),
          skipped: true,
        }, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        });
      toast.error("Setup complete! Welcome to ScrollKurai!");
      onComplete();
      setTimeout(() => navigate('/', { replace: true }), 300);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        // Allow closing the onboarding modal via overlay/Escape.
        // Treat this as skipping onboarding so it won't repeat.
        if (!open && isOpen) {
          completeOnboarding(true);
        }
      }}
    >
      <DialogContent className="max-w-2xl w-[95%] sm:w-full p-0 gap-0 border-0 bg-background/95 backdrop-blur-sm max-h-[70dvh] sm:max-h-[80vh] flex flex-col overflow-hidden rounded-xl">
        <VisuallyHidden>
          <DialogTitle>Getting Started</DialogTitle>
          <DialogDescription>
            Complete the onboarding flow to set up your account and start your journey
          </DialogDescription>
        </VisuallyHidden>
        {currentStep === 'welcome' && (
          <OnboardingWelcome onNext={() => handleNext('goal')} />
        )}
        {currentStep === 'goal' && (
          <OnboardingGoalSelection
            selectedGoal={selectedGoal}
            onSelectGoal={setSelectedGoal}
            onNext={() => handleNext('quest')}
          />
        )}
        {currentStep === 'quest' && (
          <OnboardingFirstQuest onNext={() => handleNext('invite')} />
        )}
        {currentStep === 'invite' && (
          <OnboardingInvite
            onSkip={handleSkipInvite}
            onComplete={handleCompleteInvite}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
