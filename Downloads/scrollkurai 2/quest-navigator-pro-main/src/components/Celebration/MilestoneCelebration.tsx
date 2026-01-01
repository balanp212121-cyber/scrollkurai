import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Zap, Flame } from "lucide-react";

interface MilestoneCelebrationProps {
  type: 'badge' | 'level' | 'streak';
  show: boolean;
  onComplete?: () => void;
}

export const MilestoneCelebration = ({ type, show, onComplete }: MilestoneCelebrationProps) => {
  const icons = {
    badge: Trophy,
    level: Zap,
    streak: Flame,
  };

  const colors = {
    badge: 'from-primary via-accent to-primary',
    level: 'from-primary via-purple-500 to-accent',
    streak: 'from-orange-500 via-amber-400 to-yellow-500',
  };

  const Icon = icons[type];
  const colorGradient = colors[type];

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
          onAnimationComplete={() => {
            if (onComplete) {
              setTimeout(onComplete, 2000);
            }
          }}
        >
          {/* Radial pulse effect */}
          <motion.div
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 3, opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className={`absolute w-32 h-32 rounded-full bg-gradient-to-r ${colorGradient} blur-3xl`}
          />
          
          {/* Main icon */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ 
              type: "spring",
              stiffness: 200,
              damping: 15,
              delay: 0.2 
            }}
            className="relative"
          >
            <motion.div
              animate={{ 
                rotate: [0, 10, -10, 10, 0],
                scale: [1, 1.1, 1, 1.1, 1]
              }}
              transition={{ 
                duration: 0.6,
                repeat: 2,
                delay: 0.5
              }}
              className={`w-32 h-32 rounded-full bg-gradient-to-r ${colorGradient} flex items-center justify-center shadow-2xl`}
            >
              <Icon className="w-16 h-16 text-white" strokeWidth={2.5} />
            </motion.div>
            
            {/* Sparkles around icon */}
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ 
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0],
                  x: Math.cos((i * Math.PI * 2) / 8) * 80,
                  y: Math.sin((i * Math.PI * 2) / 8) * 80,
                }}
                transition={{
                  duration: 1,
                  delay: 0.5 + (i * 0.1),
                  ease: "easeOut"
                }}
                className="absolute top-1/2 left-1/2 w-3 h-3 bg-white rounded-full"
              />
            ))}
          </motion.div>
          
          {/* Light rays */}
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={`ray-${i}`}
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: 1, opacity: [0, 0.5, 0] }}
              transition={{
                duration: 1.5,
                delay: 0.3 + (i * 0.05),
                ease: "easeOut"
              }}
              className={`absolute w-1 h-64 bg-gradient-to-t ${colorGradient} origin-center`}
              style={{
                transform: `rotate(${(i * 360) / 12}deg) translateY(-50%)`,
                top: '50%',
                left: '50%',
              }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
