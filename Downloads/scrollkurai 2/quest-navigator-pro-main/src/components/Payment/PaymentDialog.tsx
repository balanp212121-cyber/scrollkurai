import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QrCode, Smartphone, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PaymentProofUpload } from "./PaymentProofUpload";
import { isFeatureEnabled } from "@/lib/featureFlags";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  itemName: string;
  itemType: string;
  onPaymentComplete?: () => void;
}

export function PaymentDialog({
  open,
  onOpenChange,
  amount,
  itemName,
  itemType,
  onPaymentComplete,
}: PaymentDialogProps) {
  const [selectedMethod, setSelectedMethod] = useState<"paytm" | "gpay" | "qr" | null>(null);
  const [copied, setCopied] = useState(false);
  const [showUploadStep, setShowUploadStep] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);

  const manualReviewEnabled = isFeatureEnabled("enable_manual_payment_review");

  const paytmUpiId = "9042315859@ptyes";
  const gpayUpiId = "balanp212121@oksbi";
  const qrCodeUrl = "/payment-qr.jpg";

  const handleCopyUPI = () => {
    const upiId = selectedMethod === "paytm" ? paytmUpiId : gpayUpiId;
    navigator.clipboard.writeText(upiId);
    setCopied(true);
    toast.success("UPI ID copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePaymentMethod = (method: "paytm" | "gpay" | "qr") => {
    setSelectedMethod(method);
  };

  const handleCompletePayment = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Log transaction to database
      const { data: transactionData, error } = await supabase
        .from("payment_transactions")
        .insert({
          user_id: user.id,
          amount: amount,
          currency: "INR",
          payment_method: selectedMethod === "qr" ? "UPI QR Code" : selectedMethod === "paytm" ? "Paytm UPI" : "Google Pay UPI",
          item_type: itemType,
          item_name: itemName,
          status: manualReviewEnabled ? "pending_review" : "completed",
          receipt_data: {
            payment_method: selectedMethod,
            upi_id: selectedMethod === "paytm" ? paytmUpiId : selectedMethod === "gpay" ? gpayUpiId : null,
          }
        })
        .select()
        .single();

      if (error) throw error;

      if (manualReviewEnabled) {
        // Show upload step for manual review
        setTransactionId(transactionData.id);
        setShowUploadStep(true);
      } else {
        // Old flow: instant activation (no review required)
        if (itemType.toLowerCase().includes('premium') || itemType.toLowerCase().includes('subscription')) {
          const expiresAt = new Date();
          expiresAt.setMonth(expiresAt.getMonth() + 1);

          await supabase.from('subscriptions').insert({
            user_id: user.id,
            tier: 'premium',
            status: 'active',
            started_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
          });

          await supabase.rpc('set_premium_status', {
            target_user_id: user.id,
            new_status: true
          });

          // Award instant premium badges
          const { data: premiumBadges } = await supabase
            .from('badges')
            .select('id')
            .eq('requirement_type', 'premium_unlock')
            .eq('is_premium_only', true);

          if (premiumBadges && premiumBadges.length > 0) {
            const badgeInserts = premiumBadges.map(badge => ({
              user_id: user.id,
              badge_id: badge.id,
            }));

            await supabase
              .from('user_badges')
              .insert(badgeInserts)
              .select();
          }

          toast.success("Premium activated!", {
            description: "You now have access to all premium features and exclusive badges!",
          });
        } else {
          toast.success("Payment recorded successfully!", {
            description: "Thank you for your purchase",
          });
        }

        onPaymentComplete?.();
        setTimeout(() => {
          onOpenChange(false);
          setSelectedMethod(null);
        }, 1500);
      }
    } catch (error) {
      console.error("Error recording payment:", error);
      toast.error("Failed to record payment", {
        description: "Please contact support if you completed the payment",
      });
    }
  };

  const handleUploadComplete = () => {
    onPaymentComplete?.();
    setTimeout(() => {
      onOpenChange(false);
      setSelectedMethod(null);
      setShowUploadStep(false);
      setTransactionId(null);
    }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {showUploadStep ? "Upload Payment Proof" : "Complete Payment"}
          </DialogTitle>
          <DialogDescription>
            {showUploadStep 
              ? "Please upload proof of your payment"
              : `Choose your preferred payment method for ${itemName}`
            }
          </DialogDescription>
        </DialogHeader>

        {showUploadStep && transactionId ? (
          <PaymentProofUpload 
            transactionId={transactionId}
            onUploadComplete={handleUploadComplete}
          />
        ) : (
          <div className="space-y-4">
            <Card className="p-4 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/30">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Amount to Pay</p>
                <p className="text-3xl font-bold text-gold">₹{amount}</p>
              </div>
            </Card>

          {!selectedMethod ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Select Payment Method</p>
              
              <Button
                onClick={() => handlePaymentMethod("paytm")}
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-4"
              >
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-blue-500" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold">Paytm UPI</p>
                  <p className="text-xs text-muted-foreground">Pay via Paytm app</p>
                </div>
              </Button>

              <Button
                onClick={() => handlePaymentMethod("gpay")}
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-4"
              >
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-green-500" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold">Google Pay UPI</p>
                  <p className="text-xs text-muted-foreground">Pay via Google Pay</p>
                </div>
              </Button>

              <Button
                onClick={() => handlePaymentMethod("qr")}
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-4"
              >
                <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <QrCode className="w-5 h-5 text-purple-500" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold">QR Code</p>
                  <p className="text-xs text-muted-foreground">Scan with any UPI app</p>
                </div>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {selectedMethod === "qr" ? (
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/30">
                      Scan QR Code
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      Scan this QR code with any UPI app
                    </p>
                  </div>
                  <div className="flex justify-center">
                    <div className="p-4 bg-white rounded-lg">
                      <img
                        src={qrCodeUrl}
                        alt="Payment QR Code"
                        className="w-48 h-48"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <Badge className={`${
                      selectedMethod === "paytm" 
                        ? "bg-blue-500/10 text-blue-500 border-blue-500/30"
                        : "bg-green-500/10 text-green-500 border-green-500/30"
                    }`}>
                      {selectedMethod === "paytm" ? "Paytm UPI" : "Google Pay UPI"}
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      Copy UPI ID and paste in your {selectedMethod === "paytm" ? "Paytm" : "Google Pay"} app
                    </p>
                  </div>

                  <Card className="p-4 bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-2">UPI ID</p>
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-sm font-mono bg-background px-3 py-2 rounded flex-1">
                        {selectedMethod === "paytm" ? paytmUpiId : gpayUpiId}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCopyUPI}
                        className="shrink-0"
                      >
                        {copied ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </Card>

                  <Card className="p-3 bg-accent/10 border-accent/30">
                    <p className="text-xs text-center text-muted-foreground">
                      After payment, come back here and click "I've Completed Payment"
                    </p>
                  </Card>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedMethod(null)}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleCompletePayment}
                  className="flex-1 bg-gradient-to-r from-primary to-accent"
                >
                  I've Completed Payment
                </Button>
              </div>
            </div>
          )}

          <Card className="p-3 bg-muted/30 border-border/50">
            <p className="text-xs text-center text-muted-foreground">
              🔒 Secure payment powered by UPI
            </p>
          </Card>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
