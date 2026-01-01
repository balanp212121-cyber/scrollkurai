import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Zap, Sparkles, Crown } from "lucide-react";

interface BuyPowerUpsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const POWER_UP_PACKAGES = [
    { quantity: 1, priceINR: 29, label: "Starter", icon: Zap },
    { quantity: 3, priceINR: 79, label: "Popular", icon: Sparkles, popular: true },
    { quantity: 5, priceINR: 119, label: "Best Value", icon: Crown },
];

export function BuyPowerUpsModal({ open, onOpenChange }: BuyPowerUpsModalProps) {
    const [loading, setLoading] = useState<number | null>(null);

    const handlePurchase = async (pkg: typeof POWER_UP_PACKAGES[0]) => {
        setLoading(pkg.quantity);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error("Please sign in to purchase power-ups");
                return;
            }

            // Create payment transaction (pending)
            const { error: txError } = await supabase
                .from("payment_transactions")
                .insert({
                    user_id: user.id,
                    amount: pkg.priceINR,
                    currency: "INR",
                    item_type: "Power-Up",
                    item_name: `${pkg.quantity} Power-Up${pkg.quantity > 1 ? "s" : ""}`,
                    payment_method: "UPI/Card",
                    status: "pending",
                });

            if (txError) throw txError;

            // Show payment instructions (this would normally redirect to payment gateway)
            toast.success("Payment Initiated", {
                description: `Pay ₹${pkg.priceINR} to complete purchase of ${pkg.quantity} power-up${pkg.quantity > 1 ? "s" : ""}`,
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
                        <Zap className="w-5 h-5 text-amber-500" />
                        Buy Power-Ups
                    </DialogTitle>
                    <DialogDescription>
                        Power-ups boost your productivity and never expire!
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-4">
                    {POWER_UP_PACKAGES.map((pkg) => (
                        <Card
                            key={pkg.quantity}
                            className={`cursor-pointer transition-all hover:border-primary/50 ${pkg.popular ? "border-amber-500 bg-amber-500/5" : ""
                                }`}
                            onClick={() => handlePurchase(pkg)}
                        >
                            <CardContent className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${pkg.popular ? "bg-amber-500/20" : "bg-muted"
                                        }`}>
                                        <pkg.icon className={`w-5 h-5 ${pkg.popular ? "text-amber-500" : "text-muted-foreground"
                                            }`} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold">{pkg.quantity} Power-Up{pkg.quantity > 1 && "s"}</span>
                                            {pkg.popular && (
                                                <Badge className="bg-amber-500 text-xs">Most Popular</Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground">{pkg.label}</p>
                                    </div>
                                </div>
                                <Button
                                    variant={pkg.popular ? "default" : "outline"}
                                    size="sm"
                                    disabled={loading === pkg.quantity}
                                    className={pkg.popular ? "bg-amber-500 hover:bg-amber-600" : ""}
                                >
                                    {loading === pkg.quantity ? "..." : `₹${pkg.priceINR}`}
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <p className="text-xs text-muted-foreground text-center">
                    Power-ups are permanent and never expire. You still get weekly free power-ups!
                </p>
            </DialogContent>
        </Dialog>
    );
}
