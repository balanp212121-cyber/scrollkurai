import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

/**
 * Hook that checks for missed entitlements on app startup.
 * If user has approved payment proofs but no premium status, auto-activates premium.
 */
export function useEntitlementCheck() {
  useEffect(() => {
    const checkAndFixEntitlements = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Check if user has any approved payment proofs
        const { data: approvedProofs, error: proofsError } = await supabase
          .from("payment_proofs")
          .select("id, reviewed_at")
          .eq("user_id", user.id)
          .eq("status", "approved")
          .limit(1);

        if (proofsError || !approvedProofs?.length) return;

        // Check if user has premium status
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("premium_status")
          .eq("id", user.id)
          .single();

        if (profileError) return;

        // If they have approved proof but no premium, auto-fix it
        if (!profile?.premium_status) {
          console.warn("Entitlement mismatch detected - auto-fixing...");
          
          // Activate premium status
          const { error: updateError } = await supabase.rpc('set_premium_status', {
            target_user_id: user.id,
            new_status: true
          });

          if (updateError) {
            console.error("Failed to auto-activate premium:", updateError);
            toast({
              title: "Premium Activation Issue",
              description: "Your payment was approved but we couldn't activate premium. Please contact support.",
              variant: "destructive",
            });
            return;
          }

          // Create subscription record (30 days from now)
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);

          await supabase
            .from("subscriptions")
            .upsert({
              user_id: user.id,
              tier: "premium",
              status: "active",
              started_at: new Date().toISOString(),
              expires_at: expiresAt.toISOString()
            }, { onConflict: 'user_id' });

          // Refresh session to update RLS context
          await supabase.auth.refreshSession();

          console.log("Premium auto-activated successfully");
          toast({
            title: "Premium Activated! 🎉",
            description: "Your premium features have been automatically activated.",
          });
        }
      } catch (error) {
        console.error("Entitlement check error:", error);
      }
    };

    // Run check after a short delay to avoid blocking startup
    const timeout = setTimeout(checkAndFixEntitlements, 3000);
    return () => clearTimeout(timeout);
  }, []);
}
