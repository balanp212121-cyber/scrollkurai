import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UserStats {
  streak: number;
  xp: number;
  level: number;
  totalQuestsCompleted: number;
  lastQuestDate: string | null;
}

interface FriendStats {
  username: string;
  xp: number;
  todayQuestCompleted: boolean;
}

export const emotionalNotifications = {
  // Streak-based notifications
  streakReminder: (streak: number) => {
    if (streak >= 7) {
      toast.success(`Your ${streak}-day streak is legendary! Don't break it now 🔥`, {
        description: "Complete today's quest to keep the fire burning!",
        duration: 6000,
      });
    } else if (streak >= 3) {
      toast.success(`${streak} days strong! Keep the momentum going 💪`, {
        description: "You're building an incredible habit!",
        duration: 5000,
      });
    } else if (streak === 1) {
      toast.success("Great start! Day 1 of your journey 🌟", {
        description: "Come back tomorrow to build your streak!",
        duration: 5000,
      });
    }
  },

  // Competition-based notifications
  friendsAheadNotification: async (currentUserXP: number) => {
    try {
      const { data: leaderboard } = await supabase
        .from('profiles')
        .select('xp, username')
        .order('xp', { ascending: false })
        .limit(10);

      if (leaderboard) {
        const friendsAhead = leaderboard.filter(
          (friend) => friend.xp > currentUserXP
        ).length;

        if (friendsAhead > 0 && friendsAhead <= 5) {
          toast.info(`${friendsAhead} friends are ahead of you today. Time to catch up! 🏃‍♂️`, {
            description: "Complete quests to climb the leaderboard!",
            duration: 6000,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching friends data:", error);
    }
  },

  // Time saved calculation (assuming 20 min per quest completed)
  timeSavedNotification: (questsThisWeek: number) => {
    const minutesSaved = questsThisWeek * 20;
    const hoursSaved = Math.floor(minutesSaved / 60);

    if (hoursSaved >= 2) {
      toast.success(`You've saved ${hoursSaved} hours this week. That's a movie night earned! 🎬`, {
        description: "Your productivity is paying off!",
        duration: 6000,
      });
    } else if (hoursSaved >= 1) {
      toast.success(`${hoursSaved} hour saved this week! You're crushing it! ⚡`, {
        description: "Keep up the amazing work!",
        duration: 5000,
      });
    } else if (minutesSaved >= 30) {
      toast.success(`${minutesSaved} minutes saved this week! 🎯`, {
        description: "Small wins add up to big results!",
        duration: 5000,
      });
    }
  },

  // Level up celebration
  levelUpNotification: (newLevel: number) => {
    toast.success(`🎉 Level ${newLevel} Achieved!`, {
      description: `You're becoming unstoppable! Keep growing 🚀`,
      duration: 7000,
    });
  },

  // Missed day warning
  missedDayWarning: (streak: number) => {
    if (streak > 0) {
      toast.error(`Don't lose your ${streak}-day streak! ⚠️`, {
        description: "Complete today's quest before midnight!",
        duration: 6000,
      });
    }
  },

  // Comeback motivation
  comebackMotivation: (daysSinceLastQuest: number) => {
    if (daysSinceLastQuest >= 3) {
      toast.info("Welcome back, legend! 👋", {
        description: "Ready to restart your journey? Let's go!",
        duration: 6000,
      });
    }
  },

  // Achievement unlocked
  achievementUnlocked: (achievementName: string) => {
    toast.success(`🏆 Achievement Unlocked: ${achievementName}!`, {
      description: "You're on fire! Keep going!",
      duration: 7000,
    });
  },

  // Weekly summary
  weeklySummary: (questsCompleted: number, xpGained: number) => {
    toast.info(`📊 Week Summary: ${questsCompleted} quests, ${xpGained} XP!`, {
      description: "Another week of growth in the books! 📈",
      duration: 6000,
    });
  },
};

// Helper function to calculate quests completed this week
export const getQuestsThisWeek = async (userId: string): Promise<number> => {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const { data, error } = await supabase
    .from('user_quest_log')
    .select('id')
    .eq('user_id', userId)
    .gte('completed_at', oneWeekAgo.toISOString())
    .not('completed_at', 'is', null);

  if (error) {
    console.error("Error fetching weekly quests:", error);
    return 0;
  }

  return data?.length || 0;
};

// Helper function to check if user completed quest today
export const hasCompletedQuestToday = async (userId: string): Promise<boolean> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('user_quest_log')
    .select('id')
    .eq('user_id', userId)
    .gte('completed_at', today.toISOString())
    .not('completed_at', 'is', null)
    .limit(1);

  if (error) {
    console.error("Error checking today's quest:", error);
    return false;
  }

  return (data?.length || 0) > 0;
};
