import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Zap } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ActiveProtection {
    shield: {
        days_remaining: number;
        expires_at: string;
    } | null;
    xpBoost: {
        remaining_hours: number;
    } | null;
}

export function ActiveProtectionIndicator() {
    const [protection, setProtection] = useState<ActiveProtection>({
        shield: null,
        xpBoost: null,
    });

    useEffect(() => {
        fetchActiveProtection();
        const interval = setInterval(fetchActiveProtection, 60000); // Refresh every minute
        return () => clearInterval(interval);
    }, []);

    const fetchActiveProtection = async () => {
        try {
            // Check active shield
            const { data: shieldData } = await (supabase.rpc as any)("get_active_shield");

            // Check XP boost from profile
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("xp_boost_expires_at")
                    .eq("id", user.id)
                    .single();

                const xpBoostExpires = profile?.xp_boost_expires_at ? new Date(profile.xp_boost_expires_at) : null;
                const hasXpBoost = xpBoostExpires && xpBoostExpires > new Date();

                setProtection({
                    shield: shieldData?.[0] || null,
                    xpBoost: hasXpBoost ? {
                        remaining_hours: Math.ceil((xpBoostExpires.getTime() - Date.now()) / (1000 * 60 * 60))
                    } : null,
                });
            }
        } catch (error) {
            console.error("Error fetching protection:", error);
        }
    };

    if (!protection.shield && !protection.xpBoost) {
        return null;
    }

    return (
        <TooltipProvider>
            <div className="flex items-center gap-2">
                {protection.shield && (
                    <Tooltip>
                        <TooltipTrigger>
                            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/20 text-blue-500">
                                <Shield className="w-4 h-4" />
                                <span className="text-xs font-medium">{protection.shield.days_remaining}d</span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Streak Shield: {protection.shield.days_remaining} day{protection.shield.days_remaining !== 1 && "s"} remaining</p>
                        </TooltipContent>
                    </Tooltip>
                )}

                {protection.xpBoost && (
                    <Tooltip>
                        <TooltipTrigger>
                            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/20 text-amber-500">
                                <Zap className="w-4 h-4" />
                                <span className="text-xs font-medium">2×</span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>XP Boost: {protection.xpBoost.remaining_hours}h remaining</p>
                        </TooltipContent>
                    </Tooltip>
                )}
            </div>
        </TooltipProvider>
    );
}
