import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TutorialStep = 'quest-complete' | 'insights' | 'leaderboard' | 'invite' | 'completed';

interface TutorialProgress {
  current_step: TutorialStep;
  completed: boolean;
}

export const useTutorial = () => {
  const [currentStep, setCurrentStep] = useState<TutorialStep | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    initializeTutorial();
  }, []);

  const initializeTutorial = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        setIsActive(false);
        return;
      }
      
      setUserId(user.id);

      // Check localStorage first for immediate feedback
      const tutorialCompleted = localStorage.getItem(`tutorial_completed_${user.id}`);
      if (tutorialCompleted === 'true') {
        setIsActive(false);
        return;
      }

      // Check if tutorial should be triggered immediately (after onboarding completion)
      const tutorialTrigger = localStorage.getItem(`tutorial_trigger_${user.id}`);
      if (tutorialTrigger === 'true') {
        // Clear trigger flag and start tutorial immediately
        localStorage.removeItem(`tutorial_trigger_${user.id}`);
        setCurrentStep('insights');
        setIsActive(true);
        localStorage.setItem(`tutorial_step_${user.id}`, 'insights');
        localStorage.setItem(`tutorial_shown_${user.id}`, 'true');
        return;
      }

      // Check database for permanent tutorial completion tracking
      const { data: onboardingProgress } = await supabase
        .from('onboarding_progress')
        .select('completed_at')
        .eq('user_id', user.id)
        .maybeSingle();

      // If onboarding is not completed, don't show tutorial yet
      if (!onboardingProgress?.completed_at) {
        setIsActive(false);
        return;
      }

      // Check if tutorial was already shown
      const tutorialShown = localStorage.getItem(`tutorial_shown_${user.id}`);
      if (tutorialShown === 'true') {
        setIsActive(false);
        return;
      }

      // Resume existing tutorial progress if any
      const savedStep = localStorage.getItem(`tutorial_step_${user.id}`) as TutorialStep;
      if (savedStep && savedStep !== 'completed') {
        setCurrentStep(savedStep);
        setIsActive(true);
      }
    } catch (error) {
      console.error('Error initializing tutorial:', error);
      setIsActive(false);
    }
  };

  const nextStep = () => {
    if (!userId) return;

    const stepOrder: TutorialStep[] = ['insights', 'leaderboard', 'invite', 'completed'];
    const currentIndex = stepOrder.indexOf(currentStep || 'insights');
    const nextStepValue = stepOrder[currentIndex + 1];

    if (nextStepValue === 'completed') {
      completeTutorial();
    } else {
      setCurrentStep(nextStepValue);
      localStorage.setItem(`tutorial_step_${userId}`, nextStepValue);
    }
  };

  const skipTutorial = () => {
    completeTutorial();
  };

  const completeTutorial = () => {
    if (!userId) return;
    
    setCurrentStep('completed');
    setIsActive(false);
    
    // Set permanent flags to prevent tutorial from ever showing again
    localStorage.setItem(`tutorial_completed_${userId}`, 'true');
    localStorage.setItem(`tutorial_shown_${userId}`, 'true');
    localStorage.removeItem(`tutorial_step_${userId}`);
  };

  const startTutorial = () => {
    if (!userId) return;
    
    // Only allow manual restart if tutorial was already shown/completed
    const tutorialShown = localStorage.getItem(`tutorial_shown_${userId}`);
    if (tutorialShown !== 'true') {
      localStorage.setItem(`tutorial_shown_${userId}`, 'true');
    }
    
    setCurrentStep('insights');
    setIsActive(true);
    localStorage.setItem(`tutorial_step_${userId}`, 'insights');
  };

  return {
    currentStep,
    isActive,
    nextStep,
    skipTutorial,
    startTutorial,
  };
};
