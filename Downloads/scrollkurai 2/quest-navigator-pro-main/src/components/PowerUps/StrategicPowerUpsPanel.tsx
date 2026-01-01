import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sword, AlertTriangle, Clock, Zap } from "lucide-react";

interface StrategicPowerUp {
    id: string;
    name: string;
    icon: string;
    description: string;
    effect: {
        xp_multiplier?: number;
        risk?: string;
        risk_description?: string;
        extra_quests?: number;
        deadline_hours?: number;
        xp_penalty?: number;
    };
    cost_type: string;
    cooldown_days: number;
}

interface ActivePowerUp {
    powerup_id: string;
    name: string;
    icon: string;
    effect: any;
    activated_at: string;
    expires_at: string;
    outcome: string;
}

export function StrategicPowerUpsPanel() {
    const [powerups, setPowerups] = useState<StrategicPowerUp[]>([]);
    const [activePowerups, setActivePowerups] = useState<ActivePowerUp[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPowerup, setSelectedPowerup] = useState<StrategicPowerUp | null>(null);
    const [activating, setActivating] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [powerupsRes, activeRes] = await Promise.all([
                supabase.from("strategic_powerups").select("*").eq("active", true),
                (supabase.rpc as any)("get_active_strategic_powerups"),
            ]);

            if (powerupsRes.data) setPowerups(powerupsRes.data);
            if (activeRes.data) setActivePowerups(activeRes.data);
        } catch (error) {
            console.error("Error fetching power-ups:", error);
        } finally {
            setLoading(false);
        }
    };

    const activatePowerup = async () => {
        if (!selectedPowerup) return;

        setActivating(true);
        try {
            const { data, error } = await (supabase.rpc as any)("activate_strategic_powerup", {
                p_powerup_id: selectedPowerup.id,
            });

            if (error) throw error;

            if (data?.success) {
                toast.success(`${selectedPowerup.name} Activated!`, {
                    description: selectedPowerup.effect.risk_description,
                });
                fetchData();
            } else {
                toast.error(data?.reason || "Failed to activate");
            }
        } catch (error) {
            console.error("Activation error:", error);
            toast.error("Failed to activate power-up");
        } finally {
            setActivating(false);
            setSelectedPowerup(null);
        }
    };

    if (loading) {
        return (
            <Card className="p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-muted rounded w-1/3" />
                    <div className="grid grid-cols-2 gap-4">
                        {[1, 2].map((i) => (
                            <div key={i} className="h-32 bg-muted rounded" />
                        ))}
                    </div>
                </div>
            </Card>
        );
    }

    return (
        <>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                        <Sword className="w-5 h-5 text-primary" />
                        Strategic Power-Ups
                        <Badge variant="secondary" className="ml-auto">High Risk</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Active Power-Ups */}
                    {activePowerups.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium text-muted-foreground">Active</h4>
                            {activePowerups.map((active) => (
                                <div key={active.powerup_id} className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">{active.icon}</span>
                                        <div className="flex-1">
                                            <p className="font-bold">{active.name}</p>
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Clock className="w-3 h-3" />
                                                Expires: {new Date(active.expires_at).toLocaleTimeString()}
                                            </div>
                                        </div>
                                        <Badge className={active.outcome === "pending" ? "bg-amber-500" :
                                            active.outcome === "success" ? "bg-green-500" : "bg-red-500"}>
                                            {active.outcome}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Available Power-Ups */}
                    <div className="grid grid-cols-2 gap-3">
                        {powerups.map((powerup) => {
                            const isActive = activePowerups.some((a) => a.powerup_id === powerup.id);

                            return (
                                <Card
                                    key={powerup.id}
                                    className={`p-4 cursor-pointer transition-all ${isActive ? "opacity-50" : "hover:border-primary/50"
                                        }`}
                                    onClick={() => !isActive && setSelectedPowerup(powerup)}
                                >
                                    <div className="text-center">
                                        <div className="text-3xl mb-2">{powerup.icon}</div>
                                        <h3 className="font-bold text-sm">{powerup.name}</h3>
                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                            {powerup.description}
                                        </p>
                                        <Badge variant="outline" className="mt-2 text-xs">
                                            {powerup.cooldown_days}d cooldown
                                        </Badge>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Confirmation Dialog */}
            <Dialog open={!!selectedPowerup} onOpenChange={() => setSelectedPowerup(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <span className="text-3xl">{selectedPowerup?.icon}</span>
                            {selectedPowerup?.name}
                        </DialogTitle>
                        <DialogDescription>{selectedPowerup?.description}</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Reward */}
                        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                            <div className="flex items-center gap-2">
                                <Zap className="w-5 h-5 text-green-500" />
                                <span className="font-medium text-green-500">Reward</span>
                            </div>
                            <p className="text-sm mt-1">
                                {selectedPowerup?.effect.xp_multiplier && `${selectedPowerup.effect.xp_multiplier}× XP today`}
                                {selectedPowerup?.effect.extra_quests && `Complete ${selectedPowerup.effect.extra_quests} quests`}
                                {selectedPowerup?.effect.deadline_hours && `+${selectedPowerup.effect.deadline_hours} hours deadline`}
                            </p>
                        </div>

                        {/* Risk */}
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                                <span className="font-medium text-red-500">Risk</span>
                            </div>
                            <p className="text-sm mt-1">
                                {selectedPowerup?.effect.risk_description}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Button variant="outline" onClick={() => setSelectedPowerup(null)} className="flex-1">
                            Cancel
                        </Button>
                        <Button
                            onClick={activatePowerup}
                            disabled={activating}
                            className="flex-1 bg-gradient-to-r from-red-500 to-amber-500"
                        >
                            {activating ? "Activating..." : "Accept Risk"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
