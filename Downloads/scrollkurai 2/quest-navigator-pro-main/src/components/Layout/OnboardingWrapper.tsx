import { useOnboarding } from "@/hooks/useOnboarding";
import { OnboardingModal } from "@/components/Onboarding/OnboardingModal";

interface OnboardingWrapperProps {
  children: React.ReactNode;
}

export const OnboardingWrapper = ({ children }: OnboardingWrapperProps) => {
  const { needsOnboarding, loading, completeOnboarding } = useOnboarding();

  if (loading) {
    return null;
  }

  return (
    <>
      {children}
      <OnboardingModal 
        isOpen={needsOnboarding} 
        onComplete={completeOnboarding} 
      />
    </>
  );
};
