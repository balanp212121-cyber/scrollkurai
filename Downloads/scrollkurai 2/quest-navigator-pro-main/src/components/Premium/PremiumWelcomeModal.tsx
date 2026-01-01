import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Palette, Award, Zap, Shield, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PremiumWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const features = [
  {
    icon: Crown,
    title: "Welcome to ScrollKurai Pro!",
    description: "You've unlocked premium features and exclusive content",
    color: "from-gold/20 via-gold/10 to-transparent",
    highlights: [
      "Ad-free experience",
      "Priority support",
      "Exclusive premium badge",
      "Early access to new features"
    ]
  },
  {
    icon: Palette,
    title: "Premium Themes Unlocked",
    description: "Personalize your experience with exclusive themes",
    color: "from-primary/20 via-primary/10 to-transparent",
    highlights: [
      "6 exclusive premium themes",
      "Unique color schemes",
      "Custom visual styles",
      "Change themes anytime"
    ]
  },
  {
    icon: Award,
    title: "Premium Badges Earned",
    description: "Show off your premium status with exclusive badges",
    color: "from-accent/20 via-accent/10 to-transparent",
    highlights: [
      "Premium Warrior badge",
      "Exclusive achievement badges",
      "Premium profile flair",
      "Stand out in the community"
    ]
  },
  {
    icon: Zap,
    title: "Power-Ups & Boosters",
    description: "Access to premium power-ups and XP boosters",
    color: "from-gold/20 via-primary/10 to-transparent",
    highlights: [
      "2× XP booster access",
      "Streak shields",
      "Custom avatar packs",
      "Special quest rewards"
    ]
  },
  {
    icon: Shield,
    title: "Enhanced Protection",
    description: "Extra streak freezes and safety features",
    color: "from-primary/20 via-accent/10 to-transparent",
    highlights: [
      "2× streak freezes per month",
      "Priority quest access",
      "Advanced analytics",
      "Export your progress data"
    ]
  }
];

export function PremiumWelcomeModal({ isOpen, onClose }: PremiumWelcomeModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < features.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = () => {
    // Mark as seen in localStorage
    localStorage.setItem('premium_welcome_shown', 'true');
    onClose();
  };

  const currentFeature = features[currentStep];
  const Icon = currentFeature.icon;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleFinish()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border-2 border-gold/30">
        <div className="relative">
          {/* Animated Background Gradient */}
          <div className={`absolute inset-0 bg-gradient-to-br ${currentFeature.color} opacity-50`} />
          
          {/* Sparkles Effect */}
          <div className="absolute top-4 right-4">
            <Sparkles className="w-6 h-6 text-gold animate-pulse" />
          </div>
          <div className="absolute bottom-4 left-4">
            <Sparkles className="w-4 h-4 text-primary animate-pulse delay-100" />
          </div>

          {/* Content */}
          <div className="relative p-8">
            {/* Progress Indicator */}
            <div className="flex gap-2 mb-6">
              {features.map((_, index) => (
                <div
                  key={index}
                  className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                    index <= currentStep ? 'bg-gold' : 'bg-muted'
                  }`}
                />
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Icon */}
                <div className="flex justify-center">
                  <div className="p-4 bg-gradient-to-br from-gold/20 to-primary/20 rounded-full border-2 border-gold/30">
                    <Icon className="w-12 h-12 text-gold" />
                  </div>
                </div>

                {/* Title & Description */}
                <div className="text-center space-y-2">
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-gold via-primary to-accent bg-clip-text text-transparent">
                    {currentFeature.title}
                  </h2>
                  <p className="text-muted-foreground text-lg">
                    {currentFeature.description}
                  </p>
                </div>

                {/* Highlights */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {currentFeature.highlights.map((highlight, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center gap-2 p-3 bg-card/50 backdrop-blur-sm rounded-lg border border-border/50"
                    >
                      <div className="w-2 h-2 rounded-full bg-gold" />
                      <span className="text-sm">{highlight}</span>
                    </motion.div>
                  ))}
                </div>

                {/* Premium Badge */}
                {currentStep === 0 && (
                  <div className="flex justify-center pt-4">
                    <Badge className="bg-gold/20 text-gold border-gold/30 px-4 py-2 text-lg">
                      <Crown className="w-4 h-4 mr-2" />
                      Premium Member
                    </Badge>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/50">
              <Button
                variant="ghost"
                onClick={handlePrevious}
                disabled={currentStep === 0}
                className="gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>

              <div className="text-sm text-muted-foreground">
                {currentStep + 1} of {features.length}
              </div>

              <Button
                onClick={handleNext}
                className="bg-gradient-to-r from-gold to-primary hover:from-gold/90 hover:to-primary/90 gap-2"
              >
                {currentStep === features.length - 1 ? (
                  <>
                    Get Started
                    <Sparkles className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>

            {/* Skip Button */}
            <div className="text-center mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFinish}
                className="text-muted-foreground hover:text-foreground"
              >
                Skip tour
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
