import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { toast } from "sonner";

interface MilestoneCheck {
  firstBadge: boolean;
  level2: boolean;
  streak7: boolean;
}

export const useMilestoneCelebration = (userId: string | null) => {
  const [checkedMilestones, setCheckedMilestones] = useState<MilestoneCheck>({
    firstBadge: false,
    level2: false,
    streak7: false,
  });

  useEffect(() => {
    if (!userId) return;
    
    // Load previously celebrated milestones from localStorage
    const celebrated = localStorage.getItem(`milestones_celebrated_${userId}`);
    if (celebrated) {
      setCheckedMilestones(JSON.parse(celebrated));
    }
  }, [userId]);

  const triggerConfetti = (type: 'badge' | 'level' | 'streak') => {
    const configs = {
      badge: {
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#8B5CF6', '#06B6D4', '#FFD700'],
        shapes: ['circle', 'square'],
      },
      level: {
        particleCount: 200,
        spread: 120,
        origin: { y: 0.5 },
        colors: ['#8B5CF6', '#06B6D4', '#FFD700', '#FF6B9D'],
        ticks: 300,
        gravity: 0.8,
      },
      streak: {
        particleCount: 100,
        angle: 90,
        spread: 45,
        origin: { x: 0.5, y: 0.5 },
        colors: ['#FF6B00', '#FFD700', '#FF4500'],
      },
    };

    const config = configs[type];
    
    // Fire multiple bursts for more dramatic effect
    confetti(config);
    setTimeout(() => confetti(config), 150);
    setTimeout(() => confetti(config), 300);
  };

  const celebrateFirstBadge = () => {
    if (!userId || checkedMilestones.firstBadge) return;

    triggerConfetti('badge');
    
    toast.success("🎉 First Badge Unlocked!", {
      description: "You're officially a warrior! Keep collecting badges to showcase your journey.",
      duration: 5000,
    });

    const updated = { ...checkedMilestones, firstBadge: true };
    setCheckedMilestones(updated);
    localStorage.setItem(`milestones_celebrated_${userId}`, JSON.stringify(updated));
  };

  const celebrateLevel2 = () => {
    if (!userId || checkedMilestones.level2) return;

    triggerConfetti('level');
    
    toast.success("🚀 Level 2 Reached!", {
      description: "You're leveling up! Your dedication is paying off. Keep crushing those quests!",
      duration: 5000,
    });

    const updated = { ...checkedMilestones, level2: true };
    setCheckedMilestones(updated);
    localStorage.setItem(`milestones_celebrated_${userId}`, JSON.stringify(updated));
  };

  const celebrateStreak7 = () => {
    if (!userId || checkedMilestones.streak7) return;

    triggerConfetti('streak');
    
    toast.success("🔥 7-Day Streak Unlocked!", {
      description: "A full week of dedication! You're building unstoppable momentum. Don't break it now!",
      duration: 5000,
    });

    const updated = { ...checkedMilestones, streak7: true };
    setCheckedMilestones(updated);
    localStorage.setItem(`milestones_celebrated_${userId}`, JSON.stringify(updated));
  };

  const checkMilestones = (stats: {
    badgeCount: number;
    level: number;
    streak: number;
  }) => {
    if (!userId) return;

    // Check first badge
    if (stats.badgeCount >= 1 && !checkedMilestones.firstBadge) {
      setTimeout(() => celebrateFirstBadge(), 500);
    }

    // Check level 2
    if (stats.level >= 2 && !checkedMilestones.level2) {
      setTimeout(() => celebrateLevel2(), 500);
    }

    // Check 7-day streak
    if (stats.streak >= 7 && !checkedMilestones.streak7) {
      setTimeout(() => celebrateStreak7(), 500);
    }
  };

  return {
    checkMilestones,
    celebrateFirstBadge,
    celebrateLevel2,
    celebrateStreak7,
  };
};
