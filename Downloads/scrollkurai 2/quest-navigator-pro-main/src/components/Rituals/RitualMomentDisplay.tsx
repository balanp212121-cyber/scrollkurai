import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Trophy, Flame, Gift, Star } from "lucide-react";
import Confetti from "react-confetti";

interface RitualMoment {
    id: string;
    moment_type: string;
    title: string;
    description: string;
    data: any;
    created_at: string;
}

const MOMENT_ICONS: Record<string, typeof Sparkles> = {
    first_quest: Trophy,
    streak_7: Flame,
    streak_30: Flame,
    identity_chosen: Sparkles,
    weekly_recap: Star,
    rare_drop: Gift,
};

const MOMENT_COLORS: Record<string, string> = {
    first_quest: "from-green-500 to-emerald-500",
    streak_7: "from-orange-500 to-amber-500",
    streak_30: "from-red-500 to-rose-500",
    identity_chosen: "from-indigo-500 to-purple-500",
    weekly_recap: "from-blue-500 to-cyan-500",
    rare_drop: "from-pink-500 to-fuchsia-500",
};

export function RitualMomentDisplay() {
    const [moment, setMoment] = useState<RitualMoment | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);

    useEffect(() => {
        checkForUnseenMoments();
    }, []);

    const checkForUnseenMoments = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get the most recent unseen moment
            const { data, error } = await supabase
                .from("ritual_moments")
                .select("*")
                .eq("user_id", user.id)
                .is("seen_at", null)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (data) {
                setMoment(data);
                // Show confetti for special moments
                if (["first_quest", "streak_30", "rare_drop", "identity_chosen"].includes(data.moment_type)) {
                    setShowConfetti(true);
                    setTimeout(() => setShowConfetti(false), 5000);
                }
            }
        } catch (error) {
            console.error("Error checking moments:", error);
        }
    };

    const dismissMoment = async () => {
        if (!moment) return;

        await supabase
            .from("ritual_moments")
            .update({ seen_at: new Date().toISOString() })
            .eq("id", moment.id);

        setMoment(null);
    };

    if (!moment) return null;

    const Icon = MOMENT_ICONS[moment.moment_type] || Sparkles;
    const colorGradient = MOMENT_COLORS[moment.moment_type] || "from-primary to-primary/80";

    return (
        <>
            {showConfetti && (
                <Confetti
                    width={window.innerWidth}
                    height={window.innerHeight}
                    recycle={false}
                    numberOfPieces={200}
                />
            )}

            <Dialog open={!!moment} onOpenChange={() => dismissMoment()}>
                <DialogContent className="max-w-sm text-center">
                    <DialogHeader>
                        <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center bg-gradient-to-br ${colorGradient} mb-4`}>
                            <Icon className="w-10 h-10 text-white" />
                        </div>
                        <DialogTitle className="text-2xl">{moment.title}</DialogTitle>
                    </DialogHeader>

                    <p className="text-muted-foreground py-4">{moment.description}</p>

                    {moment.data?.percentile && (
                        <div className="py-4">
                            <span className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                                Top {100 - moment.data.percentile}%
                            </span>
                            <p className="text-xs text-muted-foreground mt-1">of all warriors this week</p>
                        </div>
                    )}

                    <Button onClick={dismissMoment} className={`w-full bg-gradient-to-r ${colorGradient}`}>
                        Continue
                    </Button>
                </DialogContent>
            </Dialog>
        </>
    );
}
