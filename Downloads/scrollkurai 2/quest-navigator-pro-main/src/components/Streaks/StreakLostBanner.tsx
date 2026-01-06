import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BuyStreakShieldModal } from "@/components/Streaks/BuyStreakShieldModal";
import { HeartCrack, Shield } from "lucide-react";

interface StreakLostBannerProps {
    lostStreak: number;
    onDismiss?: () => void;
}

export function StreakLostBanner({ lostStreak, onDismiss }: StreakLostBannerProps) {
    const [showShieldModal, setShowShieldModal] = useState(false);

    if (!lostStreak || lostStreak <= 0) {
        return null;
    }

    return (
        <>
            <Card className="p-4 bg-red-500/10 border-red-500/30">
                <div className="flex items-start gap-3">
                    <HeartCrack className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="font-bold text-red-500">You Lost Your Streak! 💔</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            Your {lostStreak}-day streak was broken yesterday.
                        </p>
                        <div className="flex gap-2 mt-3">
                            <Button
                                size="sm"
                                className="bg-blue-500 hover:bg-blue-600"
                                onClick={() => setShowShieldModal(true)}
                            >
                                <Shield className="w-4 h-4 mr-1" />
                                Buy Streak Insurance
                            </Button>
                            {onDismiss && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={onDismiss}
                                >
                                    Dismiss
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </Card>

            <BuyStreakShieldModal
                open={showShieldModal}
                onOpenChange={setShowShieldModal}
                streakLost={lostStreak}
            />
        </>
    );
}
