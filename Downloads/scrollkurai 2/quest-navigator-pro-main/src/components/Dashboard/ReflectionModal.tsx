import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { ReflectionInsights } from "./ReflectionInsights";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { emotionalNotifications } from "@/utils/emotionalNotifications";
import {
  clearGoldenQuest,
  checkForSurpriseReward,
  applySurpriseReward,
  showSurpriseReward,
  setGoldenQuest,
} from "@/utils/surpriseRewards";
import { BadgeUnlockModal } from "@/components/Rewards/BadgeUnlockModal";

interface Quest {
  id: string;
  content: string;
  reflection_prompt: string;
}

interface ReflectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quest: Quest;
  logId: string;
  isGoldenQuest?: boolean;
  onComplete: () => void;
}

export const ReflectionModal = ({
  open,
  onOpenChange,
  quest,
  logId,
  isGoldenQuest = false,
  onComplete,
}: ReflectionModalProps) => {
  const [reflection, setReflection] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [analyzingReflection, setAnalyzingReflection] = useState(false);
  const [previousLevel, setPreviousLevel] = useState<number | null>(null);

  // Badge unlock modal state
  const [badgeModalOpen, setBadgeModalOpen] = useState(false);
  const [unlockedBadge, setUnlockedBadge] = useState<{
    name: string;
    icon: string;
    description: string;
  } | null>(null);

  const triggerConfetti = () => {
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 9999,
    };

    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
    });

    fire(0.2, {
      spread: 60,
    });

    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 45,
    });
  };

  const validateReflection = (text: string): string | null => {
    const cleanedText = text.trim().toLowerCase();
    const textNoSpaces = cleanedText.replace(/\s/g, '');

    // === ONLY block EXTREME obvious spam ===

    // 1. Check if >85% is same character AND text is very short
    if (textNoSpaces.length > 0 && textNoSpaces.length < 30) {
      const charCounts: Record<string, number> = {};
      for (const char of textNoSpaces) {
        charCounts[char] = (charCounts[char] || 0) + 1;
      }
      const maxCharCount = Math.max(...Object.values(charCounts), 0);
      if (maxCharCount / textNoSpaces.length > 0.85) {
        return "Please write a meaningful reflection about your experience";
      }
    }

    // 2. Only block exact keyboard mashing patterns
    const extremeSpamPatterns = [
      /^(.)\1{14,}$/,                    // Same char 15+ times
      /^(asdf|qwer|zxcv){3,}$/i,          // Keyboard row 3+ times
    ];

    for (const pattern of extremeSpamPatterns) {
      if (pattern.test(textNoSpaces)) {
        return "Please write a genuine reflection, not random characters";
      }
    }

    // All other content is ALLOWED - let users express themselves!
    return null;
  };

  const handleSubmit = async () => {
    const trimmedReflection = reflection.trim();
    if (trimmedReflection.length < 15) {
      toast.error("Reflection must be at least 15 characters");
      return;
    }
    if (trimmedReflection.length > 500) {
      toast.error("Reflection cannot exceed 500 characters");
      return;
    }

    // Validate for spam/meaningless content
    const validationError = validateReflection(reflection);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Please sign in");
        return;
      }

      // Get current level before completion
      const { data: profile } = await supabase
        .from('profiles')
        .select('level')
        .eq('id', session.user.id)
        .single();

      const currentLevel = profile?.level || 1;

      const { data, error } = await supabase.functions.invoke('complete-quest', {
        body: {
          log_id: logId,
          reflection_text: reflection,
          is_golden_quest: isGoldenQuest,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Error completing quest:', error);
        // Parse error from function invoke - check both error.message and response body
        let errorMessage = 'Something went wrong, your streak is safe. Please try again.';

        // Try to extract error from the response context
        if (error.context?.body) {
          try {
            const bodyError = JSON.parse(error.context.body);
            if (bodyError?.error) {
              errorMessage = bodyError.error;
            }
          } catch {
            // Ignore parse errors
          }
        } else if (error.message && !error.message.includes('FunctionsHttpError')) {
          errorMessage = error.message;
        }

        toast.error(errorMessage);
        return;
      }

      // Check for error in response data
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      // Clear golden quest flag if it was a golden quest
      if (isGoldenQuest) {
        clearGoldenQuest(session.user.id);
      }

      triggerConfetti();

      const xpMessage = isGoldenQuest
        ? `🌟 Golden Quest Complete! +${data.xp_awarded} XP (3x Bonus!)`
        : `🎉 Quest Complete! +${data.xp_awarded} XP`;

      toast.success(xpMessage, {
        description: `Streak: ${data.streak} days | Level: ${data.level}`,
        duration: 5000,
      });

      // Check if user leveled up and trigger notification
      if (data.level > currentLevel) {
        setTimeout(() => {
          emotionalNotifications.levelUpNotification(data.level);
        }, 1500);
      }

      // Trigger AI analysis for premium users
      setAnalyzingReflection(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.functions.invoke('analyze-reflection', {
            body: {
              quest_log_id: logId,
              reflection_text: reflection,
              quest_content: quest.content,
            },
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });
        }
        setShowInsights(true);
      } catch (error) {
        console.error('AI analysis failed:', error);
        // Don't block completion if AI fails
      } finally {
        setAnalyzingReflection(false);
      }

      onComplete();

      // Auto-sync challenge progress after quest completion
      try {
        await supabase.functions.invoke('update-challenge-progress');
        console.log('Challenge progress synced automatically');
      } catch (error) {
        console.error('Auto-sync challenge progress failed:', error);
        // Don't block completion if sync fails
      }

      // Check for surprise rewards ONLY after completing a quest
      try {
        const reward = await checkForSurpriseReward(session.user.id);
        if (reward) {
          const success = await applySurpriseReward(session.user.id, reward);
          if (success) {
            if (reward.type === 'mystery_badge') {
              // Parse badge info and show animated modal
              const badgeMatch = reward.message.match(/Mystery Badge Unlocked:\s*([^🎁⭐🍀💎🦉🐦✨⚡🌙🕐🌌]+?)\s*([🎁⭐🍀💎🦉🐦✨⚡🌙🕐🌌]+)/);
              if (badgeMatch) {
                setUnlockedBadge({
                  name: badgeMatch[1].trim(),
                  icon: badgeMatch[2],
                  description: reward.description,
                });
                // Delay badge modal to not overlap with quest completion
                setTimeout(() => {
                  setBadgeModalOpen(true);
                }, 2500);
              }
            } else if (reward.type === 'golden_quest') {
              setGoldenQuest(session.user.id);
              setTimeout(() => {
                showSurpriseReward(reward);
              }, 2000);
            } else {
              // Show toast for XP rewards
              setTimeout(() => {
                showSurpriseReward(reward);
              }, 2000);
            }
          }
        }
      } catch (error) {
        console.error('Surprise rewards check failed:', error);
        // Don't block completion if rewards check fails
      }

      // Keep modal open briefly to show insights
      setTimeout(() => {
        onOpenChange(false);
        setReflection("");
        setShowInsights(false);
      }, 5000);
    } catch (error) {
      console.error('Error:', error);
      toast.error("Something went wrong, your streak is safe. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Quest Reflection
            </DialogTitle>
            <DialogDescription>
              Take a moment to reflect on your accomplishment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted/50 rounded-lg border border-border">
              <p className="font-medium">{quest.content}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reflection">{quest.reflection_prompt}</Label>
              <Textarea
                id="reflection"
                placeholder="Share your thoughts..."
                value={reflection}
                onChange={(e) => setReflection(e.target.value.slice(0, 500))}
                className="min-h-[120px] resize-none"
                maxLength={500}
              />
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>Minimum 15 characters • Maximum 500</p>
                <p className={reflection.trim().length < 15 ? 'text-yellow-500' : 'text-green-500'}>
                  {reflection.trim().length} / 500 characters
                </p>
              </div>
            </div>

            {showInsights && (
              <ReflectionInsights questLogId={logId} />
            )}

            {analyzingReflection && (
              <div className="text-center py-2">
                <p className="text-sm text-muted-foreground animate-pulse">
                  ✨ AI is analyzing your reflection...
                </p>
              </div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={submitting || reflection.trim().length < 15 || reflection.trim().length > 500 || showInsights}
              className={`w-full ${isGoldenQuest
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white'
                : 'bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90'
                }`}
              size="lg"
            >
              {submitting
                ? "Submitting..."
                : showInsights
                  ? "Quest Completed!"
                  : isGoldenQuest
                    ? "Complete & Claim 3x Rewards!"
                    : "Complete & Claim Rewards"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Badge Unlock Animation Modal */}
      {unlockedBadge && (
        <BadgeUnlockModal
          open={badgeModalOpen}
          onOpenChange={setBadgeModalOpen}
          badgeName={unlockedBadge.name}
          badgeIcon={unlockedBadge.icon}
          badgeDescription={unlockedBadge.description}
        />
      )}
    </>
  );
};
