import { supabase } from "@/integrations/supabase/client";

export type SmartNotificationEvent = 
  | 'quest_complete'
  | 'streak_milestone'
  | 'theme_unlock'
  | 'return_after_gap'
  | 'assessment_complete'
  | 'milestone_reached'
  | 'friend_ahead'
  | 'time_saved';

interface SendSmartNotificationParams {
  userId: string;
  eventType: SmartNotificationEvent;
  eventContext?: Record<string, any>;
  customMessage?: string;
}

/**
 * Sends a smart, context-aware push notification to a user.
 * Automatically handles:
 * - Rate limiting (max 1 per 6 hours)
 * - Deduplication (no repeat events within 24 hours)
 * - Personalization based on user profile
 * - Respects user notification preferences
 */
export async function sendSmartNotification({
  userId,
  eventType,
  eventContext,
  customMessage,
}: SendSmartNotificationParams): Promise<{
  sent: boolean;
  reason?: string;
  message?: string;
  title?: string;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('send-smart-notification', {
      body: {
        userId,
        eventType,
        eventContext,
        customMessage,
      },
    });

    if (error) {
      console.error('Error sending smart notification:', error);
      return { sent: false, reason: 'error' };
    }

    return data;
  } catch (error) {
    console.error('Error invoking smart notification function:', error);
    return { sent: false, reason: 'error' };
  }
}

/**
 * Triggers smart notifications based on user actions and events.
 * This is the main entry point for event-driven notifications.
 */
export const SmartNotificationTriggers = {
  /**
   * Trigger when user completes a quest
   */
  onQuestComplete: async (userId: string, questName?: string) => {
    await sendSmartNotification({
      userId,
      eventType: 'quest_complete',
      eventContext: { quest_name: questName },
    });
  },

  /**
   * Trigger on streak milestones (7, 14, 30, 60, 100 days)
   */
  onStreakMilestone: async (userId: string, streakCount: number) => {
    // Only notify on significant milestones
    const milestones = [7, 14, 30, 60, 100];
    if (milestones.includes(streakCount)) {
      await sendSmartNotification({
        userId,
        eventType: 'streak_milestone',
        eventContext: { streak: streakCount },
      });
    }
  },

  /**
   * Trigger when user unlocks a premium theme
   */
  onThemeUnlock: async (userId: string, themeName: string) => {
    await sendSmartNotification({
      userId,
      eventType: 'theme_unlock',
      eventContext: { theme_name: themeName },
    });
  },

  /**
   * Trigger when user returns after being inactive
   */
  onReturnAfterGap: async (userId: string, daysGone: number) => {
    // Only notify if user has been gone for 3+ days
    if (daysGone >= 3) {
      await sendSmartNotification({
        userId,
        eventType: 'return_after_gap',
        eventContext: { days_gone: daysGone },
      });
    }
  },

  /**
   * Trigger when user completes onboarding assessment
   */
  onAssessmentComplete: async (userId: string) => {
    await sendSmartNotification({
      userId,
      eventType: 'assessment_complete',
    });
  },

  /**
   * Trigger when user hits a milestone (XP, quests, etc.)
   */
  onMilestoneReached: async (userId: string, milestoneType: string, milestoneValue: number) => {
    await sendSmartNotification({
      userId,
      eventType: 'milestone_reached',
      eventContext: { milestone_type: milestoneType, milestone_value: milestoneValue },
    });
  },

  /**
   * Trigger when friends are ahead in competition
   */
  onFriendAhead: async (userId: string, friendCount: number) => {
    await sendSmartNotification({
      userId,
      eventType: 'friend_ahead',
      eventContext: { friend_count: friendCount },
    });
  },

  /**
   * Trigger when user saves significant time
   */
  onTimeSaved: async (userId: string, hoursSaved: number) => {
    // Only notify on weekly summary (not every day)
    if (hoursSaved >= 2) {
      await sendSmartNotification({
        userId,
        eventType: 'time_saved',
        eventContext: { hours_saved: hoursSaved },
      });
    }
  },
};
