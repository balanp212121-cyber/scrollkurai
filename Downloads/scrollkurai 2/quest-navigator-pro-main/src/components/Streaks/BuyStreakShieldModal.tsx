import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, Clock, CheckCircle } from "lucide-react";

interface BuyStreakShieldModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    streakLost?: number; // The streak value that was lost
}

const SHIELD_PACKAGES = [
    { days: 1, priceINR: 19, label: "24-Hour Shield" },
    { days: 7, priceINR: 49, label: "Weekly Shield", popular: true },
    { days: 30, priceINR: 99, label: "Monthly Shield" },
];

export function BuyStreakShieldModal({ open, onOpenChange, streakLost }: BuyStreakShieldModalProps) {
    const [loading, setLoading] = useState<number | null>(null);
    const [activeShield, setActiveShield] = useState<any>(null);

    useEffect(() => {
        if (open) {
            checkActiveShield();
        }
    }, [open]);

    const checkActiveShield = async () => {
        const { data } = await (supabase.rpc as any)("get_active_shield");
        if (data && data.length > 0) {
            setActiveShield(data[0]);
        }
    };

    const handlePurchase = async (pkg: typeof SHIELD_PACKAGES[0]) => {
        if (activeShield) {
            toast.error("You already have an active shield");
            return;
        }

        setLoading(pkg.days);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error("Please sign in to purchase");
                return;
            }

            // Create payment transaction (pending)
            const { error: txError } = await supabase
                .from("payment_transactions")
                .insert({
                    user_id: user.id,
                    amount: pkg.priceINR,
                    currency: "INR",
                    item_type: "Streak Shield",
                    item_name: pkg.label,
                    payment_method: "UPI/Card",
                    status: "pending",
                });

            if (txError) throw txError;

            toast.success("Payment Initiated", {
                description: `Pay ₹${pkg.priceINR} to activate your ${pkg.label}`,
            });

            onOpenChange(false);
        } catch (error) {
            console.error("Purchase error:", error);
            toast.error("Failed to initiate purchase");
        } finally {
            setLoading(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-blue-500" />
                        Streak Shield
                    </DialogTitle>
                    <DialogDescription>
                        Protect your streak from future missed days
                    </DialogDescription>
                </DialogHeader>

                {activeShield ? (
                    <Card className="p-4 bg-blue-500/10 border-blue-500/30">
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="w-5 h-5 text-blue-500" />
                            <span className="font-bold">Shield Active!</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {activeShield.days_remaining} day{activeShield.days_remaining !== 1 && "s"} remaining
                        </p>
                    </Card>
                ) : (
                    <>
                        {streakLost && (
                            <Card className="p-4 bg-red-500/10 border-red-500/30">
                                <p className="text-sm text-red-500 font-medium">
                                    💔 You lost your {streakLost}-day streak!
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Buy a shield to restore it and protect future streaks
                                </p>
                            </Card>
                        )}

                        <div className="space-y-3 py-4">
                            {SHIELD_PACKAGES.map((pkg) => (
                                <Card
                                    key={pkg.days}
                                    className={`cursor-pointer transition-all hover:border-primary/50 ${pkg.popular ? "border-blue-500 bg-blue-500/5" : ""
                                        }`}
                                    onClick={() => handlePurchase(pkg)}
                                >
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-full ${pkg.popular ? "bg-blue-500/20" : "bg-muted"
                                                }`}>
                                                <Shield className={`w-5 h-5 ${pkg.popular ? "text-blue-500" : "text-muted-foreground"
                                                    }`} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold">{pkg.label}</span>
                                                    {pkg.popular && (
                                                        <Badge className="bg-blue-500 text-xs">Best Value</Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Clock className="w-3 h-3" /> {pkg.days} day{pkg.days > 1 && "s"} protection
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            variant={pkg.popular ? "default" : "outline"}
                                            size="sm"
                                            disabled={loading === pkg.days}
                                            className={pkg.popular ? "bg-blue-500 hover:bg-blue-600" : ""}
                                        >
                                            {loading === pkg.days ? "..." : `₹${pkg.priceINR}`}
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        <p className="text-xs text-muted-foreground text-center">
                            Shield protects one missed day during its active period
                        </p>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
