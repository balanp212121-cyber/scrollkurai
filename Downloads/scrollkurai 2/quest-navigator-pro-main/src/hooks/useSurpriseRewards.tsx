import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  checkForSurpriseReward, 
  applySurpriseReward, 
  showSurpriseReward,
  setGoldenQuest,
} from "@/utils/surpriseRewards";
import { BadgeUnlockModal } from "@/components/Rewards/BadgeUnlockModal";

export const useSurpriseRewards = () => {
  const [badgeModalOpen, setBadgeModalOpen] = useState(false);
  const [unlockedBadge, setUnlockedBadge] = useState<{
    name: string;
    icon: string;
    description: string;
  } | null>(null);

  // Event-driven reward check - only call this after completing a task
  const checkRewardsAfterQuestComplete = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check for surprise rewards
      const reward = await checkForSurpriseReward(user.id);
      
      if (reward) {
        // Apply the reward
        const success = await applySurpriseReward(user.id, reward);
        
        if (success) {
          if (reward.type === 'mystery_badge') {
            // Extract badge info from message - format: "🏆 Mystery Badge Unlocked: Name Icon"
            const badgeMatch = reward.message.match(/Mystery Badge Unlocked:\s*([^🎁⭐🍀💎]+?)\s*([🎁⭐🍀💎🦉🐦✨⚡🌙🕐🌌]+)/);
            if (badgeMatch) {
              setUnlockedBadge({
                name: badgeMatch[1].trim(),
                icon: badgeMatch[2],
                description: reward.description,
              });
              setBadgeModalOpen(true);
            } else {
              console.error('Failed to parse badge info from message:', reward.message);
            }
          } else if (reward.type === 'golden_quest') {
            setGoldenQuest(user.id);
            showSurpriseReward(reward);
          } else {
            showSurpriseReward(reward);
          }
        }
      }
    } catch (error) {
      console.error('Error checking surprise rewards:', error);
    }
  }, []);

  const BadgeModal = unlockedBadge ? (
    <BadgeUnlockModal
      open={badgeModalOpen}
      onOpenChange={setBadgeModalOpen}
      badgeName={unlockedBadge.name}
      badgeIcon={unlockedBadge.icon}
      badgeDescription={unlockedBadge.description}
    />
  ) : null;

  return { BadgeModal, checkRewardsAfterQuestComplete };
};
