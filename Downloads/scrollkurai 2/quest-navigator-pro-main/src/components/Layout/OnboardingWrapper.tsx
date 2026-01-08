import { useOnboarding } from "@/hooks/useOnboarding";
import { OnboardingModal } from "@/components/Onboarding/OnboardingModal";

interface OnboardingWrapperProps {
  children: React.ReactNode;
}

export const OnboardingWrapper = ({ children }: OnboardingWrapperProps) => {
  const { needsOnboarding, loading, completeOnboarding } = useOnboarding();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary text-xl">Loading...</div>
      </div>
    );
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
