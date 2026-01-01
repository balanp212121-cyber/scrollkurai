import { useState, useEffect } from "react";
import { Zap, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface ActivePowerUp {
    name: string;
    icon: string;
    effect_type: string;
    expiresAt: Date;
}

export function ActivePowerUpBanner() {
    const [activePowerUps, setActivePowerUps] = useState<ActivePowerUp[]>([]);
    const [timeLeft, setTimeLeft] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchActivePowerUps();
        const interval = setInterval(updateTimeLeft, 60000); // Update every minute
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        updateTimeLeft();
    }, [activePowerUps]);

    const fetchActivePowerUps = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
            .from("profiles")
            .select("xp_booster_active, xp_booster_expires_at, streak_freeze_active, streak_freeze_expires_at")
            .eq("id", user.id)
            .single();

        if (!profile) return;

        const active: ActivePowerUp[] = [];
        const now = new Date();

        if (profile.xp_booster_active && profile.xp_booster_expires_at) {
            const expires = new Date(profile.xp_booster_expires_at);
            if (expires > now) {
                active.push({
                    name: "2× XP Boost",
                    icon: "⚡",
                    effect_type: "xp_multiplier",
                    expiresAt: expires,
                });
            }
        }

        if (profile.streak_freeze_active && profile.streak_freeze_expires_at) {
            const expires = new Date(profile.streak_freeze_expires_at);
            if (expires > now) {
                active.push({
                    name: "Streak Freeze",
                    icon: "🛡️",
                    effect_type: "streak_freeze",
                    expiresAt: expires,
                });
            }
        }

        setActivePowerUps(active);
    };

    const updateTimeLeft = () => {
        const now = new Date();
        const newTimeLeft: Record<string, string> = {};

        activePowerUps.forEach((powerUp) => {
            const diff = powerUp.expiresAt.getTime() - now.getTime();
            if (diff > 0) {
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                newTimeLeft[powerUp.effect_type] = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
            }
        });

        setTimeLeft(newTimeLeft);
    };

    if (activePowerUps.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-2 mb-4">
            {activePowerUps.map((powerUp) => (
                <div
                    key={powerUp.effect_type}
                    className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-gold/20 to-amber-500/10 border border-gold/30 rounded-lg"
                >
                    <span className="text-lg">{powerUp.icon}</span>
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-gold">{powerUp.name}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {timeLeft[powerUp.effect_type] || "..."} remaining
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}

// Small header icon for active power-ups
export function ActivePowerUpIcon() {
    const [hasActive, setHasActive] = useState(false);
    const [powerUpName, setPowerUpName] = useState("");
    const [timeRemaining, setTimeRemaining] = useState("");

    useEffect(() => {
        checkActivePowerUps();
        const interval = setInterval(checkActivePowerUps, 60000);
        return () => clearInterval(interval);
    }, []);

    const checkActivePowerUps = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
            .from("profiles")
            .select("xp_booster_active, xp_booster_expires_at")
            .eq("id", user.id)
            .single();

        if (!profile) return;

        const now = new Date();
        if (profile.xp_booster_active && profile.xp_booster_expires_at) {
            const expires = new Date(profile.xp_booster_expires_at);
            if (expires > now) {
                setHasActive(true);
                setPowerUpName("2× XP Boost");
                const diff = expires.getTime() - now.getTime();
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                setTimeRemaining(hours > 0 ? `${hours}h ${mins}m` : `${mins}m`);
                return;
            }
        }

        setHasActive(false);
    };

    if (!hasActive) return null;

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="relative cursor-pointer p-1">
                        <Zap className="w-5 h-5 text-gold animate-pulse" />
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-gold rounded-full" />
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <div className="text-sm">
                        <p className="font-medium">{powerUpName}</p>
                        <p className="text-xs text-muted-foreground">{timeRemaining} remaining</p>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
