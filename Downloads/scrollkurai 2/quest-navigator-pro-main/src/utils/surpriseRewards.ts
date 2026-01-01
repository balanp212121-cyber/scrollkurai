import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EngagementPattern {
  consecutiveDays: number;
  questsThisWeek: number;
  totalQuests: number;
  currentStreak: number;
  lastQuestDate: string | null;
}

interface SurpriseReward {
  type: 'bonus_xp' | 'mystery_badge' | 'golden_quest';
  value: number;
  message: string;
  description: string;
}

// Mystery badges that can be unlocked as surprises (matches database)
const MYSTERY_BADGES = [
  { name: 'Lucky Star', icon: '⭐', requirement: 'Randomly awarded' },
  { name: 'Serendipity', icon: '🍀', requirement: 'Perfect timing' },
  { name: 'Hidden Gem', icon: '💎', requirement: 'Special achievement' },
  { name: 'Surprise Master', icon: '🎁', requirement: 'Engagement reward' },
];

// Hidden achievement checker
const checkHiddenAchievements = async (userId: string): Promise<string | null> => {
  try {
    // Get all user's completed quests with timestamps
    const { data: completedQuests } = await supabase
      .from('user_quest_log')
      .select('completed_at')
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false });

    if (!completedQuests || completedQuests.length === 0) return null;

    // Get already earned badges to avoid duplicates
    const { data: earnedBadges } = await supabase
      .from('user_badges')
      .select('badge_id, badges(name)')
      .eq('user_id', userId);

    const earnedBadgeNames = new Set(
      earnedBadges?.map(b => (b.badges as any)?.name).filter(Boolean) || []
    );

    // Check Night Owl: Quest completed between midnight and 4 AM
    if (!earnedBadgeNames.has('Night Owl')) {
      const hasNightQuest = completedQuests.some(q => {
        const hour = new Date(q.completed_at!).getHours();
        return hour >= 0 && hour < 4;
      });
      if (hasNightQuest) return 'Night Owl';
    }

    // Check Early Bird: Quest completed before 6 AM (3 times)
    if (!earnedBadgeNames.has('Early Bird')) {
      const earlyQuests = completedQuests.filter(q => {
        const hour = new Date(q.completed_at!).getHours();
        return hour >= 0 && hour < 6;
      });
      if (earlyQuests.length >= 3) return 'Early Bird';
    }

    // Check Perfectionist: 5 quests in a single day
    if (!earnedBadgeNames.has('Perfectionist')) {
      const questsByDay = new Map<string, number>();
      completedQuests.forEach(q => {
        const day = new Date(q.completed_at!).toISOString().split('T')[0];
        questsByDay.set(day, (questsByDay.get(day) || 0) + 1);
      });
      const hasPerf = Array.from(questsByDay.values()).some(count => count >= 5);
      if (hasPerf) return 'Perfectionist';
    }

    // Check Time Master: Quest completed exactly at top of hour
    if (!earnedBadgeNames.has('Time Master')) {
      const hasTopOfHour = completedQuests.some(q => {
        const date = new Date(q.completed_at!);
        return date.getMinutes() === 0 && date.getSeconds() < 60;
      });
      if (hasTopOfHour) return 'Time Master';
    }

    // Check Cosmic Traveler: Quests at 7 different hours
    if (!earnedBadgeNames.has('Cosmic Traveler')) {
      const uniqueHours = new Set(
        completedQuests.map(q => new Date(q.completed_at!).getHours())
      );
      if (uniqueHours.size >= 7) return 'Cosmic Traveler';
    }

    // Check Midnight Warrior: Quest in final hour of day
    if (!earnedBadgeNames.has('Midnight Warrior')) {
      const hasMidnightSave = completedQuests.some(q => {
        const hour = new Date(q.completed_at!).getHours();
        return hour === 23;
      });
      if (hasMidnightSave) return 'Midnight Warrior';
    }

    return null;
  } catch (error) {
    console.error('Error checking hidden achievements:', error);
    return null;
  }
};

// Calculate engagement score based on user patterns
const calculateEngagementScore = (pattern: EngagementPattern): number => {
  let score = 0;
  
  // Consecutive days bonus (max 50 points)
  score += Math.min(pattern.consecutiveDays * 10, 50);
  
  // Weekly quests bonus (max 30 points)
  score += Math.min(pattern.questsThisWeek * 5, 30);
  
  // Streak bonus (max 20 points)
  score += Math.min(pattern.currentStreak * 2, 20);
  
  return score;
};

// Determine if user should receive a surprise reward
export const checkForSurpriseReward = async (userId: string): Promise<SurpriseReward | null> => {
  try {
    // Fetch user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!profile) return null;

    // Get quests completed this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const { data: weeklyQuests } = await supabase
      .from('user_quest_log')
      .select('completed_at')
      .eq('user_id', userId)
      .gte('completed_at', oneWeekAgo.toISOString())
      .not('completed_at', 'is', null);

    // Calculate consecutive perfect days (3 quests in last 3 days)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    
    const { data: recentQuests } = await supabase
      .from('user_quest_log')
      .select('completed_at')
      .eq('user_id', userId)
      .gte('completed_at', threeDaysAgo.toISOString())
      .not('completed_at', 'is', null);

    const engagementPattern: EngagementPattern = {
      consecutiveDays: recentQuests?.length || 0,
      questsThisWeek: weeklyQuests?.length || 0,
      totalQuests: profile.total_quests_completed,
      currentStreak: profile.streak,
      lastQuestDate: profile.last_quest_date,
    };

    const engagementScore = calculateEngagementScore(engagementPattern);
    
    // PRIORITY 1: Check for hidden achievements first (always trigger if earned)
    const hiddenAchievement = await checkHiddenAchievements(userId);
    if (hiddenAchievement) {
      // Get the badge from database
      const { data: badge } = await supabase
        .from('badges')
        .select('*')
        .eq('name', hiddenAchievement)
        .single();

      if (badge) {
        // Check if user already has this badge
        const { data: existingBadge } = await supabase
          .from('user_badges')
          .select('id')
          .eq('user_id', userId)
          .eq('badge_id', badge.id)
          .maybeSingle();

        if (!existingBadge) {
          return {
            type: 'mystery_badge',
            value: 0,
            message: `🏆 Mystery Badge Unlocked: ${badge.name} ${badge.icon}`,
            description: badge.description,
          };
        }
      }
    }
    
    // Different surprise triggers based on engagement patterns
    
    // 2. Perfect 3 days bonus - CONSISTENT: Every 3 days of activity
    const lastRewardKey = `lastSurpriseReward_${userId}`;
    const lastRewardDate = localStorage.getItem(lastRewardKey);
    const now = new Date();
    
    let shouldGiveReward = false;
    
    if (engagementPattern.consecutiveDays >= 3) {
      if (!lastRewardDate) {
        // First time - give reward
        shouldGiveReward = true;
      } else {
        // Check if 3 days have passed since last reward
        const lastReward = new Date(lastRewardDate);
        const daysSinceLastReward = Math.floor((now.getTime() - lastReward.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysSinceLastReward >= 3) {
          shouldGiveReward = true;
        }
      }
      
      if (shouldGiveReward) {
        // Store the current date as the last reward date
        localStorage.setItem(lastRewardKey, now.toISOString());
        
        return {
          type: 'bonus_xp',
          value: 500,
          message: '🎉 3-Day Consistency Bonus! You earned 500 XP for staying active!',
          description: "Your dedication is paying off! Keep your streak going!",
        };
      }
    }
    
    // 3. Golden Quest (15% chance if streak > 5)
    if (profile.streak > 5 && Math.random() < 0.15) {
      return {
        type: 'golden_quest',
        value: 3, // 3x multiplier
        message: '✨ Golden Quest Unlocked! Complete today\'s quest for 3x XP!',
        description: "This rare opportunity won't last long!",
      };
    }
    
    // 4. Random Mystery Badge (5% chance if total quests > 10) - REDUCED from 10%
    if (profile.total_quests_completed > 10 && Math.random() < 0.05) {
      const randomBadge = MYSTERY_BADGES[Math.floor(Math.random() * MYSTERY_BADGES.length)];
      
      // Get the badge from database
      const { data: badge } = await supabase
        .from('badges')
        .select('*')
        .eq('name', randomBadge.name)
        .maybeSingle();

      if (badge) {
        // Check if user already has this badge
        const { data: existingBadge } = await supabase
          .from('user_badges')
          .select('id')
          .eq('user_id', userId)
          .eq('badge_id', badge.id)
          .maybeSingle();

        if (!existingBadge) {
          return {
            type: 'mystery_badge',
            value: 0,
            message: `🏆 Mystery Badge Unlocked: ${randomBadge.name} ${randomBadge.icon}`,
            description: "A rare achievement just for you!",
          };
        }
      }
    }
    
    // 5. Milestone bonus (20% chance at milestones)
    if ([25, 50, 75, 100].includes(profile.total_quests_completed) && Math.random() < 0.2) {
      return {
        type: 'bonus_xp',
        value: 1000,
        message: `🎊 Milestone Reward! ${profile.total_quests_completed} quests completed!`,
        description: `Bonus 1000 XP for reaching this amazing milestone!`,
      };
    }

    return null;
  } catch (error) {
    console.error('Error checking for surprise reward:', error);
    return null;
  }
};

// Apply the surprise reward to user profile
export const applySurpriseReward = async (
  userId: string, 
  reward: SurpriseReward
): Promise<boolean> => {
  try {
    if (reward.type === 'bonus_xp') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('xp, level')
        .eq('id', userId)
        .single();

      if (profile) {
        const newXP = profile.xp + reward.value;
        const newLevel = Math.floor(newXP / 1000) + 1;

        await supabase
          .from('profiles')
          .update({ 
            xp: newXP,
            level: newLevel 
          })
          .eq('id', userId);

        return true;
      }
    }
    
    if (reward.type === 'mystery_badge') {
      // Extract badge name from the message
      const badgeMatch = reward.message.match(/Mystery Badge Unlocked: (.+?) (.+)/);
      if (badgeMatch) {
        const badgeName = badgeMatch[1];
        
        // Get the badge from database
        const { data: badge } = await supabase
          .from('badges')
          .select('*')
          .eq('name', badgeName)
          .maybeSingle();

        if (badge) {
          // Insert into user_badges
          const { error } = await supabase
            .from('user_badges')
            .insert({
              user_id: userId,
              badge_id: badge.id
            });

          // Ignore duplicate errors
          if (error && !error.message?.includes('duplicate') && error.code !== '23505') {
            console.error('Error inserting badge:', error);
            return false;
          }

          return true;
        }
      }
      return false;
    }

    if (reward.type === 'golden_quest') {
      // Golden quest multiplier is handled during quest completion
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error applying surprise reward:', error);
    return false;
  }
};

// Show surprise reward notification
export const showSurpriseReward = (reward: SurpriseReward) => {
  toast.success(reward.message, {
    description: reward.description,
    duration: 8000,
  });
};

// Check if today's quest is a Golden Quest
export const isGoldenQuest = async (userId: string): Promise<boolean> => {
  try {
    // Check if user has a golden quest flag in local storage for today
    const today = new Date().toDateString();
    const storedGoldenQuest = localStorage.getItem(`golden_quest_${userId}`);
    
    if (storedGoldenQuest === today) {
      return true;
    }
    
    return false;
  } catch (error) {
    return false;
  }
};

// Set golden quest for today
export const setGoldenQuest = (userId: string) => {
  const today = new Date().toDateString();
  localStorage.setItem(`golden_quest_${userId}`, today);
};

// Clear golden quest
export const clearGoldenQuest = (userId: string) => {
  localStorage.removeItem(`golden_quest_${userId}`);
};
