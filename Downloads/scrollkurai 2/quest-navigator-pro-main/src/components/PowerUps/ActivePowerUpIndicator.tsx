import { useState, useEffect } from "react";
import { Zap, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface PowerUpStatus {
  xpBoosterActive: boolean;
  xpBoosterExpiresAt: Date | null;
  streakFreezeActive: boolean;
  streakFreezeExpiresAt: Date | null;
}

export function ActivePowerUpIndicator() {
  const [status, setStatus] = useState<PowerUpStatus>({
    xpBoosterActive: false,
    xpBoosterExpiresAt: null,
    streakFreezeActive: false,
    streakFreezeExpiresAt: null,
  });
  const [xpTimeRemaining, setXpTimeRemaining] = useState("");
  const [freezeTimeRemaining, setFreezeTimeRemaining] = useState("");

  useEffect(() => {
    const fetchPowerUpStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("xp_booster_active, xp_booster_expires_at, streak_freeze_active, streak_freeze_expires_at")
        .eq("id", user.id)
        .single();

      if (profile) {
        const now = new Date();
        const xpExpires = profile.xp_booster_expires_at ? new Date(profile.xp_booster_expires_at) : null;
        const freezeExpires = profile.streak_freeze_expires_at ? new Date(profile.streak_freeze_expires_at) : null;

        setStatus({
          xpBoosterActive: profile.xp_booster_active && xpExpires && xpExpires > now,
          xpBoosterExpiresAt: xpExpires,
          streakFreezeActive: profile.streak_freeze_active && freezeExpires && freezeExpires > now,
          streakFreezeExpiresAt: freezeExpires,
        });
      }
    };

    fetchPowerUpStatus();

    // Listen for profile changes
    const setupRealtimeSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const channel = supabase
        .channel('powerup-indicator-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            const now = new Date();
            const xpExpires = payload.new.xp_booster_expires_at ? new Date(payload.new.xp_booster_expires_at) : null;
            const freezeExpires = payload.new.streak_freeze_expires_at ? new Date(payload.new.streak_freeze_expires_at) : null;

            setStatus({
              xpBoosterActive: payload.new.xp_booster_active && xpExpires && xpExpires > now,
              xpBoosterExpiresAt: xpExpires,
              streakFreezeActive: payload.new.streak_freeze_active && freezeExpires && freezeExpires > now,
              streakFreezeExpiresAt: freezeExpires,
            });
          }
        )
        .subscribe();

      return channel;
    };

    const channelPromise = setupRealtimeSubscription();

    return () => {
      channelPromise.then((channel) => {
        if (channel) {
          supabase.removeChannel(channel);
        }
      });
    };
  }, []);

  // Update countdown timers
  useEffect(() => {
    const updateTimers = () => {
      const now = new Date();

      if (status.xpBoosterActive && status.xpBoosterExpiresAt) {
        const remaining = status.xpBoosterExpiresAt.getTime() - now.getTime();
        if (remaining > 0) {
          setXpTimeRemaining(formatTimeCompact(remaining));
        } else {
          setStatus(prev => ({ ...prev, xpBoosterActive: false }));
        }
      }

      if (status.streakFreezeActive && status.streakFreezeExpiresAt) {
        const remaining = status.streakFreezeExpiresAt.getTime() - now.getTime();
        if (remaining > 0) {
          setFreezeTimeRemaining(formatTimeCompact(remaining));
        } else {
          setStatus(prev => ({ ...prev, streakFreezeActive: false }));
        }
      }
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);

    return () => clearInterval(interval);
  }, [status.xpBoosterActive, status.xpBoosterExpiresAt, status.streakFreezeActive, status.streakFreezeExpiresAt]);

  const formatTimeCompact = (ms: number): string => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h`;
    }
    return `${minutes}m`;
  };

  const hasActivePowerUps = status.xpBoosterActive || status.streakFreezeActive;

  if (!hasActivePowerUps) {
    return null;
  }

  return (
    <Link to="/power-ups" className="flex items-center gap-1">
      {status.xpBoosterActive && (
        <div 
          className={cn(
            "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium",
            "bg-amber-500/20 text-amber-500 border border-amber-500/30",
            "animate-pulse"
          )}
          title="XP Booster Active"
        >
          <Zap className="w-3 h-3" />
          <span>{xpTimeRemaining}</span>
        </div>
      )}
      {status.streakFreezeActive && (
        <div 
          className={cn(
            "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium",
            "bg-cyan-500/20 text-cyan-500 border border-cyan-500/30"
          )}
          title="Streak Freeze Active"
        >
          <Shield className="w-3 h-3" />
          <span>{freezeTimeRemaining}</span>
        </div>
      )}
    </Link>
  );
}
