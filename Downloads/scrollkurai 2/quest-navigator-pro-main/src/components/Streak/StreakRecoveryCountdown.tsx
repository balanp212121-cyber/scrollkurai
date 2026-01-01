import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Shield, AlertTriangle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StreakRecoverySuccessModal } from "./StreakRecoverySuccessModal";

interface StreakRecoveryCountdownProps {
  userId: string;
  streakLostAt: string;
  lastStreakCount: number;
  onRecovered?: () => void;
  onExpired?: () => void;
}

const RECOVERY_WINDOW_HOURS = 24;

export function StreakRecoveryCountdown({
  userId,
  streakLostAt,
  lastStreakCount,
  onRecovered,
  onExpired,
}: StreakRecoveryCountdownProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [hasInsurance, setHasInsurance] = useState(false);
  const [isRecovered, setIsRecovered] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [restoredStreak, setRestoredStreak] = useState(0);

  useEffect(() => {
    checkInsurance();
    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 1000);
    return () => clearInterval(interval);
  }, [streakLostAt]);

  const checkInsurance = async () => {
    try {
      const { data, error } = await supabase
        .from('user_power_ups')
        .select('id, power_ups!inner(effect_type)')
        .eq('user_id', userId)
        .is('used_at', null)
        .eq('power_ups.effect_type', 'streak_save')
        .limit(1);

      if (!error && data && data.length > 0) {
        setHasInsurance(true);
      }
    } catch (err) {
      console.error('Error checking insurance:', err);
    }
  };

  const updateTimeRemaining = () => {
    const lostAt = new Date(streakLostAt);
    const expiresAt = new Date(lostAt.getTime() + RECOVERY_WINDOW_HOURS * 60 * 60 * 1000);
    const now = new Date();
    const remaining = expiresAt.getTime() - now.getTime();

    if (remaining <= 0) {
      setIsExpired(true);
      setTimeRemaining(0);
      onExpired?.();
    } else {
      setTimeRemaining(remaining);
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
  };

  const handleRestoreStreak = async () => {
    if (!hasInsurance) {
      toast.error("No Streak Insurance available", {
        description: "Purchase Streak Insurance from the Power-Ups page to recover your streak."
      });
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

  if (isRecovered && !showSuccessModal) {
    return null;
  }

  const urgencyLevel = timeRemaining < 3 * 60 * 60 * 1000 ? 'critical' : 
                       timeRemaining < 6 * 60 * 60 * 1000 ? 'warning' : 'normal';

  return (
    <Card className={`p-4 border-2 ${
      isExpired 
        ? 'border-destructive/50 bg-destructive/5' 
        : urgencyLevel === 'critical'
          ? 'border-destructive/50 bg-destructive/5 animate-pulse'
          : urgencyLevel === 'warning'
            ? 'border-yellow-500/50 bg-yellow-500/5'
            : 'border-primary/50 bg-primary/5'
    }`}>
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-full ${
          isExpired 
            ? 'bg-destructive/20' 
            : urgencyLevel === 'critical'
              ? 'bg-destructive/20'
              : urgencyLevel === 'warning'
                ? 'bg-yellow-500/20'
                : 'bg-primary/20'
        }`}>
          {isExpired ? (
            <AlertTriangle className="w-6 h-6 text-destructive" />
          ) : (
            <Clock className={`w-6 h-6 ${
              urgencyLevel === 'critical' 
                ? 'text-destructive' 
                : urgencyLevel === 'warning'
                  ? 'text-yellow-500'
                  : 'text-primary'
            }`} />
          )}
        </div>

        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">
                {isExpired ? 'Streak Insurance Expired' : 'Recover Your Streak'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isExpired 
                  ? `Your ${lastStreakCount}-day streak could not be recovered`
                  : `Your ${lastStreakCount}-day streak can still be saved!`
                }
              </p>
            </div>
            <Badge variant={isExpired ? "destructive" : "secondary"} className="text-lg px-3 py-1">
              🔥 {lastStreakCount} days
            </Badge>
          </div>

          {!isExpired && (
            <>
              <div className={`text-2xl font-bold font-mono ${
                urgencyLevel === 'critical' 
                  ? 'text-destructive' 
                  : urgencyLevel === 'warning'
                    ? 'text-yellow-500'
                    : 'text-primary'
              }`}>
                {formatTime(timeRemaining)} left
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={handleRestoreStreak}
                  disabled={isRestoring || !hasInsurance}
                  className={hasInsurance 
                    ? "bg-primary hover:bg-primary/90" 
                    : "bg-muted text-muted-foreground"
                  }
                >
                  {isRestoring ? (
                    "Restoring..."
                  ) : hasInsurance ? (
                    <>
                      <Shield className="w-4 h-4 mr-2" />
                      Use Streak Insurance
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 mr-2" />
                      Get Streak Insurance
                    </>
                  )}
                </Button>

                {hasInsurance && (
                  <Badge variant="outline" className="text-green-500 border-green-500/50">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Insurance Available
                  </Badge>
                )}
              </div>
            </>
          )}

          {isExpired && (
            <p className="text-sm text-muted-foreground">
              The 24-hour recovery window has passed. Start a new streak by completing today's quest!
            </p>
          )}
        </div>
      </div>

      <StreakRecoverySuccessModal
        open={showSuccessModal}
        onClose={handleSuccessModalClose}
        restoredStreak={restoredStreak}
      />
    </Card>
  );
}
