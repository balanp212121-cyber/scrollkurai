import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  emotionalNotifications, 
  getQuestsThisWeek, 
  hasCompletedQuestToday 
} from "@/utils/emotionalNotifications";

export const useEmotionalNotifications = () => {
  useEffect(() => {
    const checkAndSendNotifications = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch user profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (!profile) return;

        // Check if user has completed quest today
        const completedToday = await hasCompletedQuestToday(user.id);

        // Get quests completed this week
        const questsThisWeek = await getQuestsThisWeek(user.id);

        // Calculate days since last quest
        let daysSinceLastQuest = 0;
        if (profile.last_quest_date) {
          const lastDate = new Date(profile.last_quest_date);
          const today = new Date();
          daysSinceLastQuest = Math.floor(
            (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
          );
        }

        // Send appropriate notifications based on user state
        
        // Comeback notification if user was away
        if (daysSinceLastQuest >= 3) {
          emotionalNotifications.comebackMotivation(daysSinceLastQuest);
          return; // Don't send other notifications if they're coming back
        }

        // Streak reminder if user has an active streak
        if (profile.streak > 0 && !completedToday) {
          emotionalNotifications.streakReminder(profile.streak);
        }

        // Time saved notification (weekly)
        if (questsThisWeek > 0) {
          const now = new Date();
          const dayOfWeek = now.getDay();
          // Send on Sundays (0) or Mondays (1) only
          if (dayOfWeek === 0 || dayOfWeek === 1) {
            emotionalNotifications.timeSavedNotification(questsThisWeek);
          }
        }

        // Friends ahead notification (only if user completed today)
        if (completedToday) {
          await emotionalNotifications.friendsAheadNotification(profile.xp);
        }

        // Missed day warning (send in the evening if not completed)
        const currentHour = new Date().getHours();
        if (currentHour >= 18 && !completedToday && profile.streak > 0) {
          emotionalNotifications.missedDayWarning(profile.streak);
        }

      } catch (error) {
        console.error("Error in emotional notifications:", error);
      }
    };

    // Check notifications on mount and every hour
    checkAndSendNotifications();
    const interval = setInterval(checkAndSendNotifications, 60 * 60 * 1000); // Every hour

    return () => clearInterval(interval);
  }, []);
};
