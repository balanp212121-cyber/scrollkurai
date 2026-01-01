import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useOnboarding = () => {
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Check localStorage first for immediate feedback
      const hasCompletedOnboarding = localStorage.getItem(`onboarding_completed_${user.id}`);
      if (hasCompletedOnboarding === 'true') {
        setNeedsOnboarding(false);
        setLoading(false);
        return;
      }

      // Check database for onboarding completion
      const { data: progress, error } = await supabase
        .from('onboarding_progress')
        .select('completed_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking onboarding:', error);
      }

      // Show onboarding ONLY if:
      // 1. No onboarding_progress record exists (truly first time)
      // 2. OR completed_at is null (started but didn't finish)
      // Once completed_at is set, NEVER show onboarding again
      const shouldShowOnboarding = !progress || !progress.completed_at;
      
      // If already completed in DB, set localStorage flag
      if (progress?.completed_at) {
        localStorage.setItem(`onboarding_completed_${user.id}`, 'true');
      }
      
      console.log('Onboarding check:', { 
        hasProgress: !!progress, 
        completedAt: progress?.completed_at,
        shouldShowOnboarding 
      });
      
      setNeedsOnboarding(shouldShowOnboarding);
    } catch (error) {
      console.error('Error checking onboarding:', error);
      setNeedsOnboarding(false);
    } finally {
      setLoading(false);
    }
  };

  const completeOnboarding = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Set localStorage immediately to prevent re-showing
      localStorage.setItem(`onboarding_completed_${user.id}`, 'true');
    }
    setNeedsOnboarding(false);
  };

  return { needsOnboarding, loading, completeOnboarding };
};
