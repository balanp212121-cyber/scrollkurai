import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Star, Sparkles, Gift } from "lucide-react";
import { useEffect, useState } from "react";
import confetti from "canvas-confetti";

interface ChallengeCompletionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challengeTitle: string;
  xpAwarded?: number;
  badgeAwarded?: {
    name: string;
    icon: string;
  } | null;
}

export const ChallengeCompletionModal = ({
  open,
  onOpenChange,
  challengeTitle,
  xpAwarded,
  badgeAwarded,
}: ChallengeCompletionModalProps) => {
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (open) {
      setShowContent(false);
      const timer = setTimeout(() => setShowContent(true), 100);

      // Play success sound
      try {
        const audio = new Audio('https://cdn.pixabay.com/audio/2024/09/25/audio_24e397f354.mp3'); // Smooth success chime
        audio.volume = 0.5;
        audio.play().catch(e => console.log("Audio play failed (user interaction needed usually):", e));
      } catch (e) {
        console.error("Audio error:", e);
      }

      // Trigger confetti celebration
      const duration = 3000;
      const animationEnd = Date.now() + duration;

      const fireConfetti = () => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return;

        const particleCount = 50 * (timeLeft / duration);

        // Left side
        confetti({
          particleCount: Math.floor(particleCount),
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
          colors: ['#FFD700', '#FFA500', '#FF6347', '#9333EA', '#3B82F6'],
        });

        // Right side
        confetti({
          particleCount: Math.floor(particleCount),
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
          colors: ['#FFD700', '#FFA500', '#FF6347', '#9333EA', '#3B82F6'],
        });

        if (timeLeft > 0) {
          requestAnimationFrame(fireConfetti);
        }
      };

      const confettiInterval = setInterval(fireConfetti, 250);

      return () => {
        clearTimeout(timer);
        clearInterval(confettiInterval);
      };
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-none bg-gradient-to-br from-primary/20 via-background to-accent/20 overflow-hidden">
        <AnimatePresence>
          {showContent && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", duration: 0.6 }}
              className="flex flex-col items-center text-center py-6 relative"
            >
              {/* Animated background elements */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{
                      opacity: [0, 0.3, 0],
                      scale: [0.5, 1.5, 0.5],
                      rotate: [0, 180, 360],
                    }}
                    transition={{
                      duration: 3,
                      delay: i * 0.3,
                      repeat: Infinity,
                    }}
                    className="absolute"
                    style={{
                      left: `${20 + (i * 15)}%`,
                      top: `${10 + (i * 12)}%`,
                    }}
                  >
                    <Sparkles className="w-6 h-6 text-primary" />
                  </motion.div>
                ))}
              </div>

              {/* Trophy icon */}
              <motion.div
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="relative mb-4"
              >
                <motion.div
                  animate={{
                    rotate: [0, -5, 5, -5, 0],
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    duration: 0.6,
                    repeat: 2,
                    delay: 0.5,
                  }}
                  className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 flex items-center justify-center shadow-2xl"
                >
                  <Trophy className="w-12 h-12 text-white" strokeWidth={2} />
                </motion.div>

                {/* Glow effect */}
                <div className="absolute inset-0 w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 blur-xl opacity-50 -z-10" />
              </motion.div>

              {/* Title */}
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-2xl font-bold text-foreground mb-2"
              >
                Challenge Complete!
              </motion.h2>

              {/* Challenge name */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-muted-foreground mb-6 px-4"
              >
                You've successfully completed "{challengeTitle}"
              </motion.p>

              {/* Rewards section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex flex-col gap-4 w-full px-4 mb-6"
              >
                {xpAwarded && xpAwarded > 0 && (
                  <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="flex items-center justify-center gap-3 p-4 rounded-xl bg-primary/10 border border-primary/20"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <Star className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm text-muted-foreground">XP Earned</p>
                      <p className="text-xl font-bold text-primary">+{xpAwarded} XP</p>
                    </div>
                  </motion.div>
                )}

                {badgeAwarded && (
                  <motion.div
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    className="flex items-center justify-center gap-3 p-4 rounded-xl bg-accent/10 border border-accent/20"
                  >
                    <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-2xl">
                      {badgeAwarded.icon}
                    </div>
                    <div className="text-left">
                      <p className="text-sm text-muted-foreground">Badge Unlocked</p>
                      <p className="text-lg font-bold text-accent-foreground">{badgeAwarded.name}</p>
                    </div>
                  </motion.div>
                )}

                {!xpAwarded && !badgeAwarded && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="flex items-center justify-center gap-3 p-4 rounded-xl bg-muted/50"
                  >
                    <Gift className="w-5 h-5 text-muted-foreground" />
                    <p className="text-muted-foreground">Great job completing this challenge!</p>
                  </motion.div>
                )}
              </motion.div>

              {/* Continue button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="w-full px-4"
              >
                <Button
                  onClick={() => onOpenChange(false)}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground font-semibold py-6"
                  size="lg"
                >
                  Continue
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};
