import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SubscriptionStatus {
  isExpiring: boolean;
  daysRemaining: number | null;
  expiresAt: Date | null;
}

/**
 * Hook that checks if user's subscription is expiring soon and returns status
 */
export function useSubscriptionReminder() {
  const [status, setStatus] = useState<SubscriptionStatus>({
    isExpiring: false,
    daysRemaining: null,
    expiresAt: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSubscription = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        // Check if user has premium status
        const { data: profile } = await supabase
          .from("profiles")
          .select("premium_status")
          .eq("id", user.id)
          .single();

        if (!profile?.premium_status) {
          setLoading(false);
          return;
        }

        // Check subscription expiry
        const { data: subscription } = await supabase
          .from("subscriptions")
          .select("expires_at, status")
          .eq("user_id", user.id)
          .eq("status", "active")
          .eq("tier", "premium")
          .maybeSingle();

        if (subscription?.expires_at) {
          const expiresAt = new Date(subscription.expires_at);
          const now = new Date();
          const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          // Show reminder if expiring within 7 days
          if (daysRemaining <= 7 && daysRemaining > 0) {
            setStatus({
              isExpiring: true,
              daysRemaining,
              expiresAt,
            });
          }
        }
      } catch (error) {
        console.error("Error checking subscription:", error);
      } finally {
        setLoading(false);
      }
    };

    checkSubscription();
  }, []);

  return { ...status, loading };
}
