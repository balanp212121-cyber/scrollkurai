import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

interface BadgeUnlockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  badgeName: string;
  badgeIcon: string;
  badgeDescription: string;
}

export const BadgeUnlockModal = ({
  open,
  onOpenChange,
  badgeName,
  badgeIcon,
  badgeDescription,
}: BadgeUnlockModalProps) => {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (open) {
      // Trigger confetti when modal opens
      setTimeout(() => {
        const duration = 3000;
        const end = Date.now() + duration;

        const frame = () => {
          confetti({
            particleCount: 3,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#FFD700', '#FFA500', '#FF6347'],
            zIndex: 9999,
          });
          confetti({
            particleCount: 3,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#FFD700', '#FFA500', '#FF6347'],
            zIndex: 9999,
          });

          if (Date.now() < end) {
            requestAnimationFrame(frame);
          }
        };

        frame();
      }, 500);

      // Reveal badge after animation
      setTimeout(() => setRevealed(true), 1500);
    } else {
      setRevealed(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[425px] border-2 border-primary/30 bg-gradient-to-br from-background via-primary/5 to-accent/5"
        onPointerDownOutside={(e) => {
          // Allow closing by clicking outside after badge is revealed
          if (revealed) {
            onOpenChange(false);
          } else {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          // Allow closing with Escape key after badge is revealed
          if (revealed) {
            onOpenChange(false);
          } else {
            e.preventDefault();
          }
        }}
      >
        <VisuallyHidden>
          <DialogTitle>Badge Unlocked</DialogTitle>
          <DialogDescription>
            {badgeName} - {badgeDescription}
          </DialogDescription>
        </VisuallyHidden>
        <div className="flex flex-col items-center justify-center py-8 space-y-6">
          <AnimatePresence mode="wait">
            {!revealed ? (
              <motion.div
                key="mystery-box"
                initial={{ scale: 0, rotate: 0 }}
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, 10, -10, 0],
                }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ 
                  duration: 1,
                  repeat: Infinity,
                  repeatDelay: 0.5,
                }}
                className="text-8xl"
              >
                🎁
              </motion.div>
            ) : (
              <motion.div
                key="badge-reveal"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ 
                  type: "spring",
                  stiffness: 260,
                  damping: 20,
                }}
                className="relative"
              >
                <motion.div
                  animate={{ 
                    scale: [1, 1.1, 1],
                  }}
                  transition={{ 
                    duration: 2,
                    repeat: Infinity,
                  }}
                  className="text-9xl"
                >
                  {badgeIcon}
                </motion.div>
                
                {/* Glow effect */}
                <motion.div
                  animate={{
                    opacity: [0.5, 1, 0.5],
                    scale: [1, 1.2, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                  }}
                  className="absolute inset-0 bg-primary/20 blur-3xl rounded-full -z-10"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {revealed && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-center space-y-2"
              >
                <motion.h2
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-3xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent"
                >
                  Badge Unlocked!
                </motion.h2>
                
                <motion.h3
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="text-2xl font-semibold"
                >
                  {badgeName}
                </motion.h3>
                
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.9 }}
                  className="text-muted-foreground max-w-xs"
                >
                  {badgeDescription}
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.1, type: "spring" }}
                  className="pt-4"
                >
                  <button
                    onClick={() => onOpenChange(false)}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary/10 rounded-full border border-primary/30 hover:bg-primary/20 transition-colors cursor-pointer"
                  >
                    <span className="text-sm font-medium text-primary">
                      Claim Badge
                    </span>
                    <span>✨</span>
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
};
