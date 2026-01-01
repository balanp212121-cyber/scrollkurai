import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, ShoppingBag, Lock, Crown, Sparkles, Clock, CheckCircle, Plus, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { PaymentDialog } from "@/components/Payment/PaymentDialog";
import { PaymentProofUpload } from "@/components/Payment/PaymentProofUpload";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { ActivePowerUpCard } from "@/components/PowerUps/ActivePowerUpCard";
import { StreakRecoveryBanner } from "@/components/PowerUps/StreakRecoveryBanner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PowerUp {
  id: string;
  name: string;
  description: string;
  icon: string;
  price: number;
  effect_type: string;
  effect_value: number;
}

interface UserPowerUp {
  id: string;
  power_up_id: string;
  quantity: number;
  used_at: string | null;
  power_ups?: PowerUp;
}

interface ActivePowerUp {
  id: string;
  powerUp: PowerUp;
  activatedAt: Date;
  expiresAt: Date;
}

// Default duration in hours for power-ups
const DEFAULT_DURATION_HOURS = 24;
const MAX_WEEKLY_POWERUPS = 2;

// Extra powerup purchase options for premium users
const EXTRA_POWERUP_BUNDLES = [
  { quantity: 1, price: 29, label: "1 Extra Power-Up" },
  { quantity: 3, price: 79, label: "3 Power-Ups Bundle", savings: "Save ₹8" },
  { quantity: 5, price: 119, label: "5 Power-Ups Bundle", savings: "Save ₹26" },
];

// Get start of current week (Monday)
const getWeekStart = (): Date => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  const weekStart = new Date(now.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
};

export default function PowerUpsPage() {
  const [powerUps, setPowerUps] = useState<PowerUp[]>([]);
  const [activePowerUps, setActivePowerUps] = useState<ActivePowerUp[]>([]);
  const [weeklyUsageCount, setWeeklyUsageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedPowerUp, setSelectedPowerUp] = useState<{ id: string; name: string; price: number } | null>(null);
  const [showProofUpload, setShowProofUpload] = useState(false);
  const [currentTransactionId, setCurrentTransactionId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [hasStreakInsurance, setHasStreakInsurance] = useState(false);
  const [extraPowerUpsCount, setExtraPowerUpsCount] = useState(0);
  const [buyMoreDialogOpen, setBuyMoreDialogOpen] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState<typeof EXTRA_POWERUP_BUNDLES[0] | null>(null);
  const [pendingPowerUpForExtra, setPendingPowerUpForExtra] = useState<PowerUp | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-refresh active power-ups every minute
  useEffect(() => {
    const interval = setInterval(() => {
      updateActivePowerUps();
    }, 60000);
    return () => clearInterval(interval);
  }, [activePowerUps]);

  const getDurationHours = (powerUp: PowerUp): number => {
    // All power-ups use 24 hour duration
    // effect_value represents the multiplier (e.g., 2x XP), not duration
    return DEFAULT_DURATION_HOURS;
  };

  const updateActivePowerUps = () => {
    const now = new Date();
    setActivePowerUps(prev => prev.filter(ap => ap.expiresAt > now));
  };

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Fetch all power-ups
      const { data: powerUpsData } = await supabase
        .from('power_ups')
        .select('*')
        .order('price');

      if (powerUpsData) setPowerUps(powerUpsData);

      if (user) {
        setUserId(user.id);
        
        // Check premium status from server (authoritative)
        const { data: profile } = await supabase
          .from('profiles')
          .select('premium_status')
          .eq('id', user.id)
          .single();

        setIsPremium(profile?.premium_status === true);

        // Check if user has Streak Shield available (streak_save effect type)
        const { data: insuranceData } = await supabase
          .from('user_power_ups')
          .select('id, power_ups!inner(effect_type)')
          .eq('user_id', user.id)
          .is('used_at', null)
          .eq('power_ups.effect_type', 'streak_save')
          .limit(1);

        setHasStreakInsurance(insuranceData && insuranceData.length > 0);

        // Fetch user's active power-ups (used within duration period)
        const { data: userPowerUpsData } = await supabase
          .from('user_power_ups')
          .select('*, power_ups(*)')
          .eq('user_id', user.id)
          .not('used_at', 'is', null);

        if (userPowerUpsData && powerUpsData) {
          const now = new Date();
          const weekStart = getWeekStart();
          const active: ActivePowerUp[] = [];
          let weeklyCount = 0;

          userPowerUpsData.forEach((up: UserPowerUp) => {
            if (up.used_at && up.power_ups) {
              const activatedAt = new Date(up.used_at);
              const durationHours = getDurationHours(up.power_ups);
              const expiresAt = new Date(activatedAt.getTime() + durationHours * 60 * 60 * 1000);
              
              // Count weekly usage
              if (activatedAt >= weekStart) {
                weeklyCount++;
              }
              
              if (expiresAt > now) {
                active.push({
                  id: up.id,
                  powerUp: up.power_ups,
                  activatedAt,
                  expiresAt
                });
              }
            }
          });

          setActivePowerUps(active);
          setWeeklyUsageCount(weeklyCount);
        }

        // Fetch extra purchased powerups (unused)
        const currentWeekStart = getWeekStart();
        const { data: extraPowerUps } = await supabase
          .from('user_power_ups')
          .select('id, purchased_at')
          .eq('user_id', user.id)
          .is('used_at', null)
          .gte('purchased_at', currentWeekStart.toISOString());

        setExtraPowerUpsCount(extraPowerUps?.length || 0);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const isAlreadyActive = (powerUpId: string): boolean => {
    return activePowerUps.some(ap => ap.powerUp.id === powerUpId);
  };

  const remainingWeeklyUses = MAX_WEEKLY_POWERUPS - weeklyUsageCount;
  const totalAvailableUses = remainingWeeklyUses + extraPowerUpsCount;
  const canUsePowerUp = isPremium && totalAvailableUses > 0;
  const hasHitWeeklyLimit = isPremium && remainingWeeklyUses <= 0 && extraPowerUpsCount === 0;

  const handleUsePowerUp = async (powerUp: PowerUp) => {
    if (!isPremium) {
      toast.error("Premium required", {
        description: "Upgrade to Premium to use power-ups"
      });
      return;
    }

    // Check if we need to use an extra purchased powerup
    const needsExtraPowerUp = remainingWeeklyUses <= 0;

    if (needsExtraPowerUp && extraPowerUpsCount <= 0) {
      // Show buy more dialog instead of error
      setPendingPowerUpForExtra(powerUp);
      setBuyMoreDialogOpen(true);
      return;
    }

    if (isAlreadyActive(powerUp.id)) {
      toast.info("Already active", {
        description: `${powerUp.name} is already active!`
      });
      return;
    }

    setActivatingId(powerUp.id);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please login to use power-ups");
        return;
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const durationHours = getDurationHours(powerUp);
      const expiresAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

      // Check if we need to consume an extra purchased powerup
      if (needsExtraPowerUp) {
        // Find and mark an unused extra powerup as used
        const { data: unusedExtra, error: findError } = await supabase
          .from('user_power_ups')
          .select('id')
          .eq('user_id', user.id)
          .is('used_at', null)
          .limit(1)
          .single();

        if (findError || !unusedExtra) {
          toast.error("No extra power-ups available");
          return;
        }

        // Update the extra powerup to mark it as used
        const { error: updateError } = await supabase
          .from('user_power_ups')
          .update({
            power_up_id: powerUp.id,
            used_at: nowIso
          })
          .eq('id', unusedExtra.id);

        if (updateError) throw updateError;

        // Decrease extra count
        setExtraPowerUpsCount(prev => Math.max(0, prev - 1));
      } else {
        // Insert new usage record for regular weekly usage
        const { error } = await supabase
          .from('user_power_ups')
          .insert({
            user_id: user.id,
            power_up_id: powerUp.id,
            quantity: 1,
            used_at: nowIso
          });

        if (error) throw error;

        // Update weekly usage count
        setWeeklyUsageCount(prev => prev + 1);
      }

      // If this is an XP Booster, update profile to track booster status
      if (powerUp.effect_type === 'xp_multiplier') {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            xp_booster_active: true,
            xp_booster_started_at: nowIso,
            xp_booster_expires_at: expiresAt.toISOString(),
          })
          .eq('id', user.id);

        if (profileError) {
          console.error('Error updating XP booster status:', profileError);
        } else {
          console.log('XP Booster activated:', {
            started: nowIso,
            expires: expiresAt.toISOString(),
          });
        }
      }

      // If this is a Streak Freeze, update profile to track freeze status
      if (powerUp.effect_type === 'streak_freeze') {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            streak_freeze_active: true,
            streak_freeze_expires_at: expiresAt.toISOString(),
          })
          .eq('id', user.id);

        if (profileError) {
          console.error('Error updating Streak Freeze status:', profileError);
        } else {
          console.log('Streak Freeze activated:', {
            expires: expiresAt.toISOString(),
          });
        }
      }

      // Add to active power-ups immediately
      setActivePowerUps(prev => [...prev, {
        id: `temp-${Date.now()}`,
        powerUp,
        activatedAt: now,
        expiresAt
      }]);

      // Show success feedback
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 }
      });

      const usesInfo = needsExtraPowerUp 
        ? `Used an extra power-up. ${extraPowerUpsCount - 1} extra remaining.`
        : `${Math.max(0, remainingWeeklyUses - 1)} weekly uses left.`;

      const boosterMessage = powerUp.effect_type === 'xp_multiplier' 
        ? `${powerUp.name} is now active! You'll earn 2× XP for ${durationHours} hours.`
        : `${powerUp.name} is now active for ${durationHours} hours. ${usesInfo}`;

      toast.success("Power-up activated!", {
        description: boosterMessage
      });

    } catch (error) {
      console.error('Error using power-up:', error);
      toast.error("Failed to activate power-up");
    } finally {
      setActivatingId(null);
    }
  };

  const handlePurchaseClick = (powerUpId: string, powerUpName: string, price: number) => {
    setSelectedPowerUp({ id: powerUpId, name: powerUpName, price });
    setPaymentDialogOpen(true);
  };

  const handlePaymentComplete = async () => {
    if (!selectedPowerUp) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please login to purchase power-ups");
        return;
      }

      const { data: transaction, error: txError } = await supabase
        .from('payment_transactions')
        .insert({
          user_id: user.id,
          amount: selectedPowerUp.price,
          currency: 'INR',
          payment_method: 'UPI',
          item_type: 'Power-Up',
          item_name: selectedPowerUp.name,
          status: 'pending',
        })
        .select()
        .single();

      if (txError) throw txError;

      setCurrentTransactionId(transaction.id);
      
      if (FEATURE_FLAGS.enable_manual_payment_review) {
        setPaymentDialogOpen(false);
        setShowProofUpload(true);
      } else {
        await completePowerUpPurchase(user.id);
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error("Payment processing failed. Please try again.");
    }
  };

  const completePowerUpPurchase = async (userId: string) => {
    if (!selectedPowerUp) return;

    const { error } = await supabase
      .from('user_power_ups')
      .insert({
        user_id: userId,
        power_up_id: selectedPowerUp.id,
        quantity: 1
      });

    if (error) throw error;

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });

    toast.success(`${selectedPowerUp.name} purchased!`, {
      description: "Check your inventory to use it"
    });

    await fetchData();
  };

  const handleProofUploadComplete = () => {
    setShowProofUpload(false);
    setCurrentTransactionId(null);
    setSelectedPowerUp(null);
    setSelectedBundle(null);
    
    toast.success("Payment proof uploaded!", {
      description: "Your purchase will be activated once approved by our team"
    });
  };

  // Buy More Powerups handlers
  const handleBuyMoreClick = (bundle: typeof EXTRA_POWERUP_BUNDLES[0]) => {
    setSelectedBundle(bundle);
    setBuyMoreDialogOpen(false);
    setPaymentDialogOpen(true);
  };

  const handleBuyMorePaymentComplete = async () => {
    if (!selectedBundle) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please login to purchase power-ups");
        return;
      }

      const { data: transaction, error: txError } = await supabase
        .from('payment_transactions')
        .insert({
          user_id: user.id,
          amount: selectedBundle.price,
          currency: 'INR',
          payment_method: 'UPI',
          item_type: 'Extra Power-Ups',
          item_name: selectedBundle.label,
          status: 'pending',
        })
        .select()
        .single();

      if (txError) throw txError;

      setCurrentTransactionId(transaction.id);
      
      if (FEATURE_FLAGS.enable_manual_payment_review) {
        setPaymentDialogOpen(false);
        setShowProofUpload(true);
      } else {
        await completeExtraPowerUpPurchase(user.id, selectedBundle.quantity);
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error("Payment processing failed. Please try again.");
    }
  };

  const completeExtraPowerUpPurchase = async (userId: string, quantity: number) => {
    // Insert multiple powerups - using a default powerup id (we'll use the first available)
    const defaultPowerUp = powerUps[0];
    if (!defaultPowerUp) {
      toast.error("No power-ups available");
      return;
    }

    const inserts = Array.from({ length: quantity }, () => ({
      user_id: userId,
      power_up_id: defaultPowerUp.id,
      quantity: 1,
      // No used_at means it's unused/available
    }));

    const { error } = await supabase
      .from('user_power_ups')
      .insert(inserts);

    if (error) throw error;

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });

    toast.success(`${quantity} Extra Power-Up${quantity > 1 ? 's' : ''} purchased!`, {
      description: "You can use them immediately"
    });

    setExtraPowerUpsCount(prev => prev + quantity);
    setSelectedBundle(null);
    setPaymentDialogOpen(false);

    // If there was a pending powerup to use, use it now
    if (pendingPowerUpForExtra) {
      setTimeout(() => {
        handleUsePowerUp(pendingPowerUpForExtra);
        setPendingPowerUpForExtra(null);
      }, 500);
    }
  };

  if (loading) {
    return <div className="text-center text-muted-foreground">Loading power-ups...</div>;
  }

  return (
    <div className="pb-20 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Zap className="w-8 h-8 text-gold" />
        <div>
          <h1 className="text-3xl font-bold">Power-Ups</h1>
          <p className="text-sm text-muted-foreground">
            Boost your journey with special items
          </p>
        </div>
      </div>

      {/* Premium Banner */}
      {isPremium ? (
        <Card className="p-4 bg-gradient-to-r from-gold/20 to-amber-500/20 border-gold/50">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Crown className="w-6 h-6 text-gold" />
              <div>
                <p className="font-semibold text-gold">Premium Unlocked</p>
                <p className="text-sm text-muted-foreground">
                  {remainingWeeklyUses > 0 
                    ? `${remainingWeeklyUses} of ${MAX_WEEKLY_POWERUPS} weekly uses left`
                    : `Weekly limit reached`
                  }
                  {extraPowerUpsCount > 0 && ` + ${extraPowerUpsCount} extra`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge 
                variant={totalAvailableUses > 0 ? "default" : "destructive"} 
                className="text-lg px-3 py-1"
              >
                {totalAvailableUses} available
              </Badge>
              {hasHitWeeklyLimit && (
                <Button
                  onClick={() => setBuyMoreDialogOpen(true)}
                  size="sm"
                  className="bg-gold hover:bg-gold/90 text-black"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Buy More
                </Button>
              )}
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-4 bg-gradient-to-r from-primary/20 to-accent/20 border-primary/30">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-6 h-6 text-primary" />
            <p className="text-sm">
              Power-ups help you maintain streaks, earn more XP, and customize your experience
            </p>
          </div>
        </Card>
      )}

      {/* Streak Recovery Banner */}
      {userId && (
        <StreakRecoveryBanner
          userId={userId}
          hasInsurance={hasStreakInsurance}
          onRecovered={fetchData}
        />
      )}

      {/* Active Power-Ups Section */}
      {activePowerUps.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Active Power-Ups</h2>
            <Badge variant="secondary" className="ml-auto">
              {activePowerUps.length} active
            </Badge>
          </div>
          <div className="grid gap-3">
            {activePowerUps.map((ap) => (
              <ActivePowerUpCard
                key={ap.id}
                powerUp={ap.powerUp}
                activatedAt={ap.activatedAt}
                expiresAt={ap.expiresAt}
              />
            ))}
          </div>
        </div>
      )}

      {/* Power-Ups Grid */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Available Power-Ups</h2>
        <div className="grid gap-4">
          {powerUps.map((powerUp) => {
            const active = isAlreadyActive(powerUp.id);
            return (
              <Card 
                key={powerUp.id} 
                className={`p-6 transition-colors ${
                  active 
                    ? 'border-green-500/50 bg-green-500/5'
                    : isPremium 
                      ? 'hover:border-gold/50 border-gold/20' 
                      : 'hover:border-primary/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-4 flex-1">
                    <div className="text-4xl relative">
                      {powerUp.icon}
                      {active && (
                        <CheckCircle className="w-4 h-4 text-green-500 absolute -top-1 -right-1" />
                      )}
                      {isPremium && !active && (
                        <Sparkles className="w-4 h-4 text-gold absolute -top-1 -right-1" />
                      )}
                    </div>
                    <div className="space-y-2 flex-1">
                      <h3 className="text-lg font-bold">{powerUp.name}</h3>
                      <p className="text-sm text-muted-foreground">{powerUp.description}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-accent/20 text-accent border-accent/30">
                          {powerUp.effect_type.replace('_', ' ')}
                        </Badge>
                        {powerUp.effect_value > 1 && (
                          <Badge className="bg-primary/20 text-primary border-primary/30">
                            {powerUp.effect_value}x effect
                          </Badge>
                        )}
                        {isPremium && (
                          <Badge className={`${totalAvailableUses > 0 ? 'bg-gold/20 text-gold border-gold/30' : 'bg-amber-500/20 text-amber-500 border-amber-500/30'}`}>
                            <Crown className="w-3 h-3 mr-1" />
                            {totalAvailableUses > 0 ? `${totalAvailableUses} available` : 'Buy more'}
                          </Badge>
                        )}
                        {active && (
                          <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Active
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right space-y-2">
                    {isPremium ? (
                      <>
                        <div className="text-sm text-gold font-medium">
                          {getDurationHours(powerUp)}h duration
                        </div>
                        {hasHitWeeklyLimit && !active ? (
                          <Button 
                            onClick={() => {
                              setPendingPowerUpForExtra(powerUp);
                              setBuyMoreDialogOpen(true);
                            }}
                            className="w-full bg-amber-500 hover:bg-amber-500/90 text-black"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Buy More
                          </Button>
                        ) : (
                          <Button 
                            onClick={() => handleUsePowerUp(powerUp)}
                            disabled={activatingId === powerUp.id || active}
                            className={`w-full ${
                              active 
                                ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30' 
                                : 'bg-gold hover:bg-gold/90 text-black'
                            }`}
                            variant={active ? "outline" : "default"}
                          >
                            {activatingId === powerUp.id 
                              ? "Activating..." 
                              : active 
                                ? "Active" 
                                : "Use Now"
                            }
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="text-2xl font-bold text-gold">₹{powerUp.price}</div>
                        <Button 
                          onClick={() => handlePurchaseClick(powerUp.id, powerUp.name, powerUp.price)}
                          variant="outline"
                          className="w-full"
                        >
                          <Lock className="w-4 h-4 mr-2" />
                          Purchase
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Footer Notice */}
      <Card className="p-4 bg-muted/50">
        <p className="text-xs text-center text-muted-foreground">
          {isPremium 
            ? hasHitWeeklyLimit
              ? `🛒 Need more power-ups? Purchase extras anytime!`
              : `✨ Premium members get ${MAX_WEEKLY_POWERUPS} power-ups per week. Resets every Monday!`
            : "💳 Secure payments via UPI (Paytm, Google Pay, QR Code)"
          }
        </p>
      </Card>

      {/* Buy More Powerups Dialog */}
      <Dialog open={buyMoreDialogOpen} onOpenChange={setBuyMoreDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-gold" />
              Buy More Power-Ups
            </DialogTitle>
            <DialogDescription>
              You've used all your weekly power-ups. Purchase extra power-ups to continue boosting!
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {EXTRA_POWERUP_BUNDLES.map((bundle) => (
              <Card 
                key={bundle.quantity}
                className="p-4 hover:border-gold/50 cursor-pointer transition-colors"
                onClick={() => handleBuyMoreClick(bundle)}
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-semibold">{bundle.label}</p>
                    {bundle.savings && (
                      <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-xs">
                        {bundle.savings}
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-gold">₹{bundle.price}</p>
                    <p className="text-xs text-muted-foreground">
                      ₹{(bundle.price / bundle.quantity).toFixed(0)} each
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Extra power-ups can be used anytime and don't expire
          </p>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog - for regular purchases */}
      {selectedPowerUp && !selectedBundle && (
        <PaymentDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          amount={selectedPowerUp.price}
          itemName={selectedPowerUp.name}
          itemType="Power-Up"
          onPaymentComplete={handlePaymentComplete}
        />
      )}

      {/* Payment Dialog - for extra powerups */}
      {selectedBundle && (
        <PaymentDialog
          open={paymentDialogOpen}
          onOpenChange={(open) => {
            setPaymentDialogOpen(open);
            if (!open) setSelectedBundle(null);
          }}
          amount={selectedBundle.price}
          itemName={selectedBundle.label}
          itemType="Extra Power-Ups"
          onPaymentComplete={handleBuyMorePaymentComplete}
        />
      )}

      {/* Payment Proof Upload */}
      {showProofUpload && currentTransactionId && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg">
            <PaymentProofUpload
              transactionId={currentTransactionId}
              onUploadComplete={handleProofUploadComplete}
            />
          </div>
        </div>
      )}
    </div>
  );
}
