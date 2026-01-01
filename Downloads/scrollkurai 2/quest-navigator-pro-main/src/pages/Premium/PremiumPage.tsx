import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Check, Zap, Shield, Brain, Video, MessageSquare } from "lucide-react";
import { PremiumFeatureCard } from "@/components/Premium/PremiumFeatureCard";
import { PaymentDialog } from "@/components/Payment/PaymentDialog";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type PlanType = "monthly" | "yearly";

export default function PremiumPage() {
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("monthly");
  const navigate = useNavigate();
  
  const handlePaymentComplete = () => {
    toast.success("Welcome to Premium!", {
      description: "You now have access to all premium features. Try the AI Chatbot!",
      duration: 5000,
    });
    // Small delay to let the subscription sync, then navigate to chatbot
    setTimeout(() => {
      navigate("/premium/chatbot");
    }, 2000);
  };

  const handleUpgrade = (plan: PlanType) => {
    setSelectedPlan(plan);
    setPaymentDialogOpen(true);
  };
  
  const features = [
    "Ad-free experience",
    "2× Streak Freezes per week",
    "Advanced analytics & insights",
    "Exclusive badges & themes",
    "Early access to new challenges",
    "AI Coaching Chatbot",
    "Personalized video courses",
    "Priority support",
  ];

  const planDetails = {
    monthly: {
      amount: 99,
      originalPrice: 199,
      itemName: "ScrollKurai Premium (Monthly)",
      period: "/month",
      discount: "50% OFF",
    },
    yearly: {
      amount: 999,
      originalPrice: 1999,
      itemName: "ScrollKurai Premium (Yearly)",
      period: "/year",
      discount: "Save ₹1000",
    },
  };

  return (
    <div className="pb-20 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Crown className="w-8 h-8 text-gold" />
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gold to-accent bg-clip-text text-transparent">
            ScrollKurai Pro
          </h1>
          <p className="text-sm text-muted-foreground">
            Unlock your full potential
          </p>
        </div>
      </div>

      {/* Pricing Card */}
      <Card className="relative overflow-hidden border-gold/50 bg-gradient-to-br from-card to-gold/5">
        <div className="absolute top-4 right-4">
          <Badge className="bg-gold text-gold-foreground border-gold/50">
            <Crown className="w-3 h-3 mr-1" />
            PREMIUM
          </Badge>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-4">Premium Membership</h2>
            
            {/* Plan Selection */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {/* Monthly Plan */}
              <button
                onClick={() => setSelectedPlan("monthly")}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  selectedPlan === "monthly"
                    ? "border-gold bg-gold/10"
                    : "border-border hover:border-gold/50"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Monthly</span>
                  <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                    50% OFF
                  </Badge>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm text-muted-foreground line-through">₹199</span>
                  <span className="text-2xl font-bold text-gold">₹99</span>
                </div>
                <span className="text-xs text-muted-foreground">/month</span>
              </button>

              {/* Yearly Plan */}
              <button
                onClick={() => setSelectedPlan("yearly")}
                className={`p-4 rounded-xl border-2 transition-all text-left relative ${
                  selectedPlan === "yearly"
                    ? "border-gold bg-gold/10"
                    : "border-border hover:border-gold/50"
                }`}
              >
                <div className="absolute -top-2 -right-2">
                  <Badge className="bg-accent text-accent-foreground text-xs">
                    BEST VALUE
                  </Badge>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Yearly</span>
                  <Badge className="bg-accent/20 text-accent border-accent/30 text-xs">
                    Save ₹1000
                  </Badge>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm text-muted-foreground line-through">₹1999</span>
                  <span className="text-2xl font-bold text-gold">₹999</span>
                </div>
                <span className="text-xs text-muted-foreground">/year</span>
              </button>
            </div>

            <p className="text-xs text-primary font-medium">
              🎓 Student Launch Offer — Limited Time!
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-gold" />
              Everything you need to succeed
            </h3>
            <div className="grid gap-2">
              {features.map((feature, index) => (
                <div key={index} className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <Button 
            onClick={() => handleUpgrade(selectedPlan)}
            className="w-full bg-gradient-to-r from-gold to-accent hover:from-gold/90 hover:to-accent/90 text-background font-bold" 
            size="lg"
          >
            <Crown className="w-4 h-4 mr-2" />
            Upgrade to Premium ({selectedPlan === "yearly" ? "₹999/year" : "₹99/month"})
          </Button>

          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-border">
            <div className="text-center">
              <Shield className="w-5 h-5 text-accent mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Secure</p>
            </div>
            <div className="text-center">
              <Zap className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Instant</p>
            </div>
            <div className="text-center">
              <Crown className="w-5 h-5 text-gold mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Premium</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Premium Features */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Premium Features</h2>
        
        <PremiumFeatureCard
          icon={<Brain className="w-6 h-6 text-primary" />}
          title="AI Coaching Chatbot"
          description="Get personalized guidance and tips to reduce scrolling habits"
          link="/premium/chatbot"
        />
        
        <PremiumFeatureCard
          icon={<Video className="w-6 h-6 text-accent" />}
          title="Video Courses"
          description="5-10 minute lessons on mindfulness and productivity"
          link="/premium/courses"
        />
        
        <PremiumFeatureCard
          icon={<MessageSquare className="w-6 h-6 text-gold" />}
          title="Monthly Check-ins"
          description="1-on-1 wellness sessions to track your progress"
          link="/premium/checkins"
        />
      </div>

      {/* Payment Dialog */}
      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        amount={planDetails[selectedPlan].amount}
        itemName={planDetails[selectedPlan].itemName}
        itemType="Premium Subscription"
        onPaymentComplete={handlePaymentComplete}
      />
    </div>
  );
}