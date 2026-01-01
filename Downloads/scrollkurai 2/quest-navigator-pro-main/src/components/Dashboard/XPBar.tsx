import { motion } from "framer-motion";

interface XPBarProps {
  currentXP: number;
  level: number;
}

export const XPBar = ({ currentXP, level }: XPBarProps) => {
  const xpForNextLevel = level * 1000;
  const xpInCurrentLevel = currentXP % 1000;
  const progress = (xpInCurrentLevel / 1000) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Level {level}</span>
        <span className="text-muted-foreground">
          {xpInCurrentLevel} / 1000 XP
        </span>
      </div>
      <div className="h-3 bg-secondary rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%]"
          initial={{ width: 0 }}
          animate={{ 
            width: `${progress}%`,
            backgroundPosition: ['0% 0%', '100% 0%']
          }}
          transition={{ 
            width: { duration: 1, ease: "easeOut" },
            backgroundPosition: { duration: 2, repeat: Infinity, ease: "linear" }
          }}
        />
      </div>
    </div>
  );
};
