import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flame, Sparkles, Trophy, Star } from "lucide-react";
import confetti from "canvas-confetti";

interface StreakRecoverySuccessModalProps {
  open: boolean;
  onClose: () => void;
  restoredStreak: number;
}

export function StreakRecoverySuccessModal({
  open,
  onClose,
  restoredStreak,
}: StreakRecoverySuccessModalProps) {
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (open) {
      // Delay content reveal for dramatic effect
      setTimeout(() => setShowContent(true), 100);

      // Multi-burst confetti celebration
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }

        const particleCount = 50 * (timeLeft / duration);

        // Fire from both sides
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          colors: ['#ff6b35', '#f7c59f', '#ffd700', '#ff8c00'],
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          colors: ['#ff6b35', '#f7c59f', '#ffd700', '#ff8c00'],
        });
      }, 250);

      // Big center burst
      setTimeout(() => {
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.6 },
          colors: ['#ff6b35', '#f7c59f', '#ffd700', '#ff8c00', '#ffffff'],
          zIndex: 9999,
        });
      }, 500);

      return () => clearInterval(interval);
    } else {
      setShowContent(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md border-2 border-orange-500/50 bg-gradient-to-br from-background via-background to-orange-500/10 overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-orange-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-yellow-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <Sparkles className="absolute top-4 right-4 w-6 h-6 text-yellow-500/50 animate-pulse" />
          <Star className="absolute bottom-4 left-4 w-5 h-5 text-orange-500/50 animate-pulse" style={{ animationDelay: '0.5s' }} />
        </div>

        <div className={`relative z-10 flex flex-col items-center text-center py-6 space-y-6 transition-all duration-700 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          {/* Animated flame icon */}
          <div className="relative">
            <div className="absolute inset-0 bg-orange-500/30 rounded-full blur-xl animate-pulse scale-150" />
            <div className="relative p-6 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full shadow-2xl shadow-orange-500/50 animate-scale-in">
              <Flame className="w-12 h-12 text-white" />
            </div>
            <Trophy className="absolute -bottom-2 -right-2 w-8 h-8 text-yellow-500 animate-bounce" />
          </div>

          {/* Success message */}
          <div className="space-y-2">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 bg-clip-text text-transparent">
              Streak Restored!
            </h2>
            <p className="text-muted-foreground">
              Your dedication paid off. Keep the fire burning!
            </p>
          </div>

          {/* Streak count with animation */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-amber-500/20 rounded-2xl blur-lg" />
            <div className="relative px-8 py-4 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border-2 border-orange-500/30 rounded-2xl">
              <div className="flex items-center gap-3">
                <Flame className="w-8 h-8 text-orange-500" />
                <div className="text-left">
                  <p className="text-sm text-muted-foreground">Your streak is back</p>
                  <p className="text-4xl font-bold text-orange-500">
                    {restoredStreak} <span className="text-xl">days</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Motivational badges */}
          <div className="flex flex-wrap gap-2 justify-center">
            <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/30 px-3 py-1">
              <Flame className="w-3 h-3 mr-1" />
              Streak Saved
            </Badge>
            <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 px-3 py-1">
              <Star className="w-3 h-3 mr-1" />
              Never Give Up
            </Badge>
            <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 px-3 py-1">
              <Trophy className="w-3 h-3 mr-1" />
              Resilient
            </Badge>
          </div>

          {/* CTA button */}
          <Button
            onClick={onClose}
            size="lg"
            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold px-8 shadow-lg shadow-orange-500/30 transition-all hover:scale-105"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Continue My Journey
          </Button>

          <p className="text-xs text-muted-foreground">
            Complete today's quest to keep your streak alive!
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
