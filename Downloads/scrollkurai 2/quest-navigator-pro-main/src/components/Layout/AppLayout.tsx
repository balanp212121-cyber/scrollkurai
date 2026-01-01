import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Navigation/Header";
import { MobileNav } from "@/components/Navigation/MobileNav";
import { PWAInstallPrompt } from "@/components/PWA/PWAInstallPrompt";
import { OnboardingWrapper } from "@/components/Layout/OnboardingWrapper";
import { initializePushNotifications } from "@/utils/pushNotifications";
import { useEmotionalNotifications } from "@/hooks/useEmotionalNotifications";
import { useEnsureUserProfile } from "@/hooks/useEnsureUserProfile";
import { useEntitlementCheck } from "@/hooks/useEntitlementCheck";


interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Initialize emotional notifications
  useEmotionalNotifications();
  
  // Ensure user profile exists (fallback mechanism)
  useEnsureUserProfile();
  
  // Check for missed entitlements on startup
  useEntitlementCheck();

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        // Handle invalid/expired session
        if (error || (!session && location.pathname !== "/auth")) {
          // Clear any stale auth data
          await supabase.auth.signOut();
          navigate("/auth");
        } else if (session) {
          // Initialize push notifications when user is logged in
          initializePushNotifications();
        }
      } catch (err) {
        console.error("Session check error:", err);
        // On error, redirect to auth
        navigate("/auth");
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Handle token refresh errors
      if (event === 'TOKEN_REFRESHED' && !session) {
        await supabase.auth.signOut();
        navigate("/auth");
        return;
      }
      
      if (event === 'SIGNED_OUT' || (!session && location.pathname !== "/auth")) {
        navigate("/auth");
      } else if (session && location.pathname === "/auth") {
        navigate("/");
        initializePushNotifications();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary text-xl">Loading ScrollKurai...</div>
      </div>
    );
  }

  if (location.pathname === "/auth") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background">
      <OnboardingWrapper>
        <Header />
        
        <main className="container mx-auto px-4 py-6 max-w-lg">
          {children}
        </main>
        <MobileNav />
        <PWAInstallPrompt />
      </OnboardingWrapper>
    </div>
  );
}
