import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Lock, Clock } from "lucide-react";
import { toast } from "sonner";
import { isFeatureEnabled } from "@/lib/featureFlags";

interface PremiumRouteGuardProps {
  children: React.ReactNode;
}

export function PremiumRouteGuard({ children }: PremiumRouteGuardProps) {
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [hasPendingProof, setHasPendingProof] = useState(false);
  const [isExpiringSoon, setIsExpiringSoon] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const navigate = useNavigate();
  const manualReviewEnabled = isFeatureEnabled("enable_manual_payment_review");

  useEffect(() => {
    checkPremiumStatus();
  }, []);

  const checkPremiumStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to access premium features");
        navigate('/auth');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('premium_status')
        .eq('id', user.id)
        .single();

      if (manualReviewEnabled) {
        // Check if user has pending payment proof
        const { data: pendingProof } = await supabase
          .from('payment_proofs')
          .select('status')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .limit(1)
          .maybeSingle();

        setHasPendingProof(!!pendingProof);

        // Check if user has approved payment proof
        const { data: approvedProof } = await supabase
          .from('payment_proofs')
          .select('*, payment_transactions!inner(item_type)')
          .eq('user_id', user.id)
          .eq('status', 'approved')
          .order('reviewed_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Check if approved proof is for premium purchase
        const hasApprovedPremiumProof = approvedProof?.payment_transactions?.item_type?.toLowerCase().includes('premium') || 
                                        approvedProof?.payment_transactions?.item_type?.toLowerCase().includes('subscription');

        // Check subscription expiry
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('status, expires_at')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('expires_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const isSubscriptionValid = subscription && 
          subscription.status === 'active' && 
          (!subscription.expires_at || new Date(subscription.expires_at) > new Date());

        // Check if subscription is expiring soon (within 5 days)
        if (subscription?.expires_at) {
          const expiresAt = new Date(subscription.expires_at);
          const now = new Date();
          const diffTime = expiresAt.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays <= 5 && diffDays > 0) {
            setIsExpiringSoon(true);
            setDaysRemaining(diffDays);
          }
        }

        setIsPremium((hasApprovedPremiumProof && isSubscriptionValid) || profile?.premium_status || false);
      } else {
        // Old flow: check premium_status and subscription expiry
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('status, expires_at')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('expires_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const isSubscriptionValid = subscription && 
          subscription.status === 'active' && 
          (!subscription.expires_at || new Date(subscription.expires_at) > new Date());

        // Check if subscription is expiring soon (within 5 days)
        if (subscription?.expires_at) {
          const expiresAt = new Date(subscription.expires_at);
          const now = new Date();
          const diffTime = expiresAt.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays <= 5 && diffDays > 0) {
            setIsExpiringSoon(true);
            setDaysRemaining(diffDays);
          }
        }

        setIsPremium((profile?.premium_status && isSubscriptionValid) || false);
      }
    } catch (error) {
      console.error('Error checking premium status:', error);
      setIsPremium(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-primary text-xl">Verifying access...</div>
      </div>
    );
  }

  if (!isPremium) {
    return (
      <div className="pb-20 space-y-6">
        <Card className="p-8 text-center border-gold/50 bg-gradient-to-br from-card to-gold/5">
          {hasPendingProof && manualReviewEnabled ? (
            <>
              <Clock className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Payment Under Review</h2>
              <p className="text-muted-foreground mb-6">
                Your payment proof is being reviewed by our team. You'll get access once approved.
              </p>
              <p className="text-sm text-muted-foreground">
                This usually takes 1-2 hours during business hours
              </p>
            </>
          ) : (
            <>
              <Lock className="w-16 h-16 text-gold mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Premium Feature</h2>
              <p className="text-muted-foreground mb-6">
                Upgrade to ScrollKurai Pro to unlock this feature
              </p>
              <Button
                onClick={() => navigate('/premium')}
                className="bg-gradient-to-r from-gold to-accent hover:from-gold/90 hover:to-accent/90"
                size="lg"
              >
                <Crown className="w-4 h-4 mr-2" />
                Upgrade to Premium
              </Button>
            </>
          )}
        </Card>
      </div>
    );
  }

  return (
    <>
      {isExpiringSoon && daysRemaining !== null && (
        <Card className="p-4 mb-4 border-yellow-500/50 bg-gradient-to-r from-yellow-500/10 to-orange-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="font-medium text-yellow-500">
                  Your premium expires in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}
                </p>
                <p className="text-sm text-muted-foreground">
                  Renew now to keep your premium features
                </p>
              </div>
            </div>
            <Button
              onClick={() => navigate('/premium')}
              size="sm"
              className="bg-gradient-to-r from-gold to-accent hover:from-gold/90 hover:to-accent/90"
            >
              <Crown className="w-4 h-4 mr-2" />
              Renew
            </Button>
          </div>
        </Card>
      )}
      {children}
    </>
  );
}
