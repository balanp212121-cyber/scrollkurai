import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flame, Clock, Shield, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StreakRecoverySuccessModal } from "@/components/Streak/StreakRecoverySuccessModal";

interface StreakRecoveryBannerProps {
  userId: string;
  hasInsurance: boolean;
  onRecovered?: () => void;
}

const RECOVERY_WINDOW_HOURS = 24;

export function StreakRecoveryBanner({ userId, hasInsurance: initialHasInsurance, onRecovered }: StreakRecoveryBannerProps) {
  const [streakData, setStreakData] = useState<{
    streakLostAt: string | null;
    lastStreakCount: number | null;
  } | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isRecovered, setIsRecovered] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [restoredStreak, setRestoredStreak] = useState(0);

  // CRITICAL FIX: Internal state for insurance, initialized from prop but updated via real-time
  const [hasInsuranceState, setHasInsuranceState] = useState(initialHasInsurance);

  // Sync initial prop to state when it changes
  useEffect(() => {
    setHasInsuranceState(initialHasInsurance);
  }, [initialHasInsurance]);

  useEffect(() => {
    fetchStreakData();
    checkInsurance(); // Fetch authoritative state from DB
  }, [userId]);

  // Real-time subscription for insurance changes (CRITICAL: fixes "Need Insurance" bug)
  useEffect(() => {
    const channel = supabase
      .channel('streak_banner_insurance')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_power_ups',
        filter: `user_id=eq.${userId}`,
      }, () => {
        console.log('[StreakBanner] Insurance state changed, re-checking');
        checkInsurance();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (!streakData?.streakLostAt) return;

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 1000);
    return () => clearInterval(interval);
  }, [streakData]);

  const checkInsurance = async () => {
    const { data, error } = await supabase
      .from('user_power_ups')
      .select('id, power_ups!inner(effect_type)')
      .eq('user_id', userId)
      .is('used_at', null)
      .eq('power_ups.effect_type', 'streak_save')
      .limit(1);

    if (!error) {
      const hasInsurance = !!data && data.length > 0;
      setHasInsuranceState(hasInsurance);
      console.log('[StreakBanner] Insurance check result:', hasInsurance);
    }
  };

  const fetchStreakData = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('streak_lost_at, last_streak_count')
      .eq('id', userId)
      .single();

    if (!error && data) {
      setStreakData({
        streakLostAt: data.streak_lost_at,
        lastStreakCount: data.last_streak_count,
      });
    }
  };

  const updateTimeRemaining = () => {
    if (!streakData?.streakLostAt) return;

    const lostAt = new Date(streakData.streakLostAt);
    const expiresAt = new Date(lostAt.getTime() + RECOVERY_WINDOW_HOURS * 60 * 60 * 1000);
    const now = new Date();
    const remaining = expiresAt.getTime() - now.getTime();

    if (remaining <= 0) {
      setIsExpired(true);
      setTimeRemaining(0);
    } else {
      setTimeRemaining(remaining);
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const handleRestoreStreak = async () => {
    if (!hasInsuranceState) {
      toast.info("Get Streak Insurance below to recover your streak!");
      return;
    }

    setIsRestoring(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        toast.error("Please log in to restore your streak");
        return;
      }

      const { data, error } = await supabase.functions.invoke('restore-streak', {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (error) throw error;

      if (data.success) {
        setRestoredStreak(data.restored_streak);
        setShowSuccessModal(true);
        setIsRecovered(true);
      } else {
        toast.error(data.error || "Failed to restore streak");
      }
    } catch (error) {
      console.error('Error restoring streak:', error);
      toast.error("Failed to restore streak");
    } finally {
      setIsRestoring(false);
    }
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    onRecovered?.();
  };

  // Don't show if no streak to recover, already recovered, or expired
  if (!streakData?.streakLostAt || !streakData?.lastStreakCount || (isRecovered && !showSuccessModal) || isExpired) {
    return null;
  }

  const urgencyLevel = timeRemaining < 3 * 60 * 60 * 1000 ? 'critical' :
    timeRemaining < 6 * 60 * 60 * 1000 ? 'warning' : 'normal';

  return (
    <Card className={`p-4 border-2 ${urgencyLevel === 'critical'
      ? 'border-destructive bg-destructive/10 animate-pulse'
      : urgencyLevel === 'warning'
        ? 'border-yellow-500 bg-yellow-500/10'
        : 'border-orange-500 bg-orange-500/10'
      }`}>
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-full ${urgencyLevel === 'critical'
          ? 'bg-destructive/20'
          : urgencyLevel === 'warning'
            ? 'bg-yellow-500/20'
            : 'bg-orange-500/20'
          }`}>
          <Flame className={`w-6 h-6 ${urgencyLevel === 'critical'
            ? 'text-destructive'
            : urgencyLevel === 'warning'
              ? 'text-yellow-500'
              : 'text-orange-500'
            }`} />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">Recover Your {streakData.lastStreakCount}-Day Streak!</h3>
            <Badge variant="outline" className={`${urgencyLevel === 'critical'
              ? 'border-destructive text-destructive'
              : urgencyLevel === 'warning'
                ? 'border-yellow-500 text-yellow-500'
                : 'border-orange-500 text-orange-500'
              }`}>
              <Clock className="w-3 h-3 mr-1" />
              {formatTime(timeRemaining)} left
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {hasInsuranceState
              ? "You have Streak Insurance! Use it now to restore your streak."
              : "Purchase Streak Insurance below to save your streak before time runs out."
            }
          </p>
        </div>

        <Button
          onClick={handleRestoreStreak}
          disabled={isRestoring || !hasInsuranceState}
          className={hasInsuranceState
            ? "bg-orange-500 hover:bg-orange-600 text-white"
            : "bg-muted text-muted-foreground"
          }
          size="lg"
        >
          {isRestoring ? (
            "Restoring..."
          ) : hasInsuranceState ? (
            <>
              <Shield className="w-4 h-4 mr-2" />
              Restore Now
            </>
          ) : (
            <>
              <AlertTriangle className="w-4 h-4 mr-2" />
              Need Insurance
            </>
          )}
        </Button>
      </div>

      <StreakRecoverySuccessModal
        open={showSuccessModal}
        onClose={handleSuccessModalClose}
        restoredStreak={restoredStreak}
      />
    </Card>
  );
}
