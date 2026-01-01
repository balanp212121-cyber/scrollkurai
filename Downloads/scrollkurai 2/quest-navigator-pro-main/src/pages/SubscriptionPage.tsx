import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Check, Zap, Shield, TrendingUp, Gift } from "lucide-react";
import { PaymentDialog } from "@/components/Payment/PaymentDialog";

export default function SubscriptionPage() {
  const [selectedPlan] = useState<"free" | "pro">("free");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  const features = {
    free: [
      "Daily personalized quests",
      "XP and streak tracking",
      "Basic badges",
      "Leaderboard access",
      "Habit calendar",
    ],
    pro: [
      "Everything in Free",
      "AI Reflection Coach with insights",
      "Streak Insurance (1 skip/week)",
      "3 bonus quests per week",
      "Advanced analytics & trends",
      "Weekly progress reports",
      "Priority quest suggestions",
      "Ad-free experience",
    ],
  };

  return (
    <div className="pb-20 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Crown className="w-8 h-8 text-gold" />
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gold to-accent bg-clip-text text-transparent">
            Unlock Pro Features
          </h1>
          <p className="text-sm text-muted-foreground">
            Accelerate your transformation
          </p>
        </div>
      </div>

      {/* Current Plan Banner */}
      <Card className="p-4 bg-gradient-to-r from-primary/20 to-accent/20 border-primary/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Current Plan</p>
            <p className="text-xl font-bold">Free Plan</p>
          </div>
          <Badge className="bg-primary/20 text-primary border-primary/30">
            Active
          </Badge>
        </div>
      </Card>

      {/* Pro Plan Card */}
      <Card className="relative overflow-hidden border-gold/50 bg-gradient-to-br from-card to-gold/5">
        {/* Premium Badge */}
        <div className="absolute top-4 right-4">
          <Badge className="bg-gold text-gold-foreground border-gold/50">
            <Crown className="w-3 h-3 mr-1" />
            PREMIUM
          </Badge>
        </div>

        <div className="p-6 space-y-6">
          {/* Pricing */}
          <div>
            <h2 className="text-2xl font-bold mb-2">ScrollKurai Pro</h2>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-gold">$3.99</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Cancel anytime • No commitment
            </p>
          </div>

          {/* Features List */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-gold" />
              Everything you need to succeed
            </h3>
            <div className="space-y-2">
              {features.pro.map((feature, index) => (
                <div key={index} className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Button */}
          <Button 
            onClick={() => setPaymentDialogOpen(true)}
            className="w-full bg-gradient-to-r from-gold to-accent hover:from-gold/90 hover:to-accent/90 text-background font-bold" 
            size="lg"
          >
            <Crown className="w-4 h-4 mr-2" />
            Upgrade to Pro
          </Button>

          {/* Trust Indicators */}
          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-border">
            <div className="text-center">
              <Shield className="w-5 h-5 text-accent mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Secure</p>
            </div>
            <div className="text-center">
              <TrendingUp className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Results</p>
            </div>
            <div className="text-center">
              <Gift className="w-5 h-5 text-gold mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Bonus</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Free Plan Card */}
      <Card className="p-6 bg-card/50 border-primary/20">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Free Plan</h2>
            {selectedPlan === "free" && (
              <Badge className="bg-primary/20 text-primary border-primary/30">
                Current
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            {features.free.map((feature, index) => (
              <div key={index} className="flex items-start gap-2">
                <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm text-muted-foreground">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Value Proposition */}
      <Card className="p-6 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
        <div className="text-center space-y-3">
          <h3 className="text-lg font-bold">Why Upgrade?</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <div className="text-2xl">🧠</div>
              <p className="font-medium">AI Insights</p>
              <p className="text-xs text-muted-foreground">
                Personalized coaching
              </p>
            </div>
            <div className="space-y-1">
              <div className="text-2xl">🔥</div>
              <p className="font-medium">Streak Safety</p>
              <p className="text-xs text-muted-foreground">Never lose progress</p>
            </div>
            <div className="space-y-1">
              <div className="text-2xl">📊</div>
              <p className="font-medium">Deep Analytics</p>
              <p className="text-xs text-muted-foreground">Track every metric</p>
            </div>
            <div className="space-y-1">
              <div className="text-2xl">⚡</div>
              <p className="font-medium">Bonus Quests</p>
              <p className="text-xs text-muted-foreground">
                3x weekly extras
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* FAQ */}
      <Card className="p-6 bg-card/50 border-primary/20">
        <h3 className="font-bold mb-4">Common Questions</h3>
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-medium mb-1">Can I cancel anytime?</p>
            <p className="text-muted-foreground">
              Yes! Cancel with one click, no questions asked.
            </p>
          </div>
          <div>
            <p className="font-medium mb-1">What's Streak Insurance?</p>
            <p className="text-muted-foreground">
              Skip one day per week without breaking your streak.
            </p>
          </div>
          <div>
            <p className="font-medium mb-1">How does AI coaching work?</p>
            <p className="text-muted-foreground">
              Our AI analyzes your reflections and provides personalized insights
              and suggestions.
            </p>
          </div>
        </div>
      </Card>

      {/* Payment Dialog */}
      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        amount={3.99}
        itemName="ScrollKurai Pro (Monthly)"
        itemType="Pro Subscription"
      />
    </div>
  );
}
