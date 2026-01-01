import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, XCircle } from "lucide-react";

export function usePaymentProofNotifications() {
  useEffect(() => {
    const checkPaymentProofStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check for recently reviewed proofs (last 24 hours)
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const { data: recentProofs } = await supabase
        .from('payment_proofs')
        .select('*, payment_transactions!inner(item_name, item_type)')
        .eq('user_id', user.id)
        .in('status', ['approved', 'rejected'])
        .gte('reviewed_at', oneDayAgo.toISOString())
        .order('reviewed_at', { ascending: false });

      if (recentProofs && recentProofs.length > 0) {
        const lastCheck = localStorage.getItem('last_proof_notification_check');
        const lastCheckTime = lastCheck ? new Date(lastCheck) : null;

        recentProofs.forEach((proof) => {
          const reviewedAt = new Date(proof.reviewed_at);
          
          // Only show notification if reviewed after last check
          if (!lastCheckTime || reviewedAt > lastCheckTime) {
            if (proof.status === 'approved') {
              toast.success("Payment Approved! 🎉", {
                description: `Your payment for ${proof.payment_transactions.item_name} has been approved. Premium features are now active!`,
                duration: 8000,
                icon: <CheckCircle className="w-5 h-5 text-green-500" />,
              });
            } else if (proof.status === 'rejected') {
              toast.error("Payment Needs Review", {
                description: proof.admin_note 
                  ? `Admin note: ${proof.admin_note}. Please upload a clearer payment proof.`
                  : "Your payment proof was rejected. Please upload a clearer proof.",
                duration: 10000,
                icon: <XCircle className="w-5 h-5 text-red-500" />,
              });
            }
          }
        });

        localStorage.setItem('last_proof_notification_check', new Date().toISOString());
      }
    };

    checkPaymentProofStatus();

    // Set up realtime subscription for payment proof updates
    const channel = supabase
      .channel('payment-proofs-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payment_proofs',
        },
        async (payload) => {
          const { data: { user } } = await supabase.auth.getUser();
          if (user && payload.new.user_id === user.id) {
            checkPaymentProofStatus();
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);
}
