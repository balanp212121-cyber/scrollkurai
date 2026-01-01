import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BadgeUnlockModal } from "@/components/Rewards/BadgeUnlockModal";

interface BadgeType {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement_type: string;
  requirement_value: number;
  is_premium_only: boolean;
}

interface UserBadge {
  badge_id: string;
  earned_at: string;
}

interface BadgeDisplayProps {
  userId: string;
  userStats: {
    xp: number;
    level: number;
    streak: number;
    total_quests_completed: number;
  };
  isPremium?: boolean;
  onFirstBadgeUnlock?: () => void;
}

export const BadgeDisplay = ({ userId, userStats, isPremium = false, onFirstBadgeUnlock }: BadgeDisplayProps) => {
  const [allBadges, setAllBadges] = useState<BadgeType[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [badgeModalOpen, setBadgeModalOpen] = useState(false);
  const [currentUnlockedBadge, setCurrentUnlockedBadge] = useState<BadgeType | null>(null);
  const [badgeQueue, setBadgeQueue] = useState<BadgeType[]>([]);

  useEffect(() => {
    fetchBadges();
  }, []);

  useEffect(() => {
    if (allBadges.length > 0) {
      checkAndAwardBadges();
    }
  }, [userStats, allBadges]);

  useEffect(() => {
    // Show next badge in queue
    if (badgeQueue.length > 0 && !badgeModalOpen) {
      const nextBadge = badgeQueue[0];
      setCurrentUnlockedBadge(nextBadge);
      setBadgeModalOpen(true);
      setBadgeQueue(prev => prev.slice(1));
    }
  }, [badgeQueue, badgeModalOpen]);

  const fetchBadges = async () => {
    try {
      // Fetch all badges
      const { data: badges, error: badgesError } = await supabase
        .from("badges")
        .select("*")
        .order("requirement_value", { ascending: true });

      if (badgesError) throw badgesError;

      // Fetch user's earned badges
      const { data: userBadges, error: userBadgesError } = await supabase
        .from("user_badges")
        .select("badge_id, earned_at")
        .eq("user_id", userId);

      if (userBadgesError) throw userBadgesError;

      setAllBadges(badges as BadgeType[]);
      setEarnedBadges(new Set((userBadges as UserBadge[]).map((ub) => ub.badge_id)));
    } catch (error) {
      console.error("Error fetching badges:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkAndAwardBadges = async () => {
    const newlyEarned: BadgeType[] = [];

    for (const badge of allBadges) {
      if (earnedBadges.has(badge.id)) continue;

      const earned = await shouldAwardBadge(badge);
      if (earned) {
        newlyEarned.push(badge);
      }
    }

    if (newlyEarned.length > 0) {
      await awardBadges(newlyEarned);
    }
  };

  const shouldAwardBadge = async (badge: BadgeType): Promise<boolean> => {
    // Premium-only badges require premium status
    if (badge.is_premium_only && !isPremium) {
      return false;
    }

    switch (badge.requirement_type) {
      case "premium_unlock":
        return isPremium; // Instant unlock for premium users
      case "xp":
        return userStats.xp >= badge.requirement_value;
      case "level":
        return userStats.level >= badge.requirement_value;
      case "streak":
        return userStats.streak >= badge.requirement_value;
      case "quests":
        return userStats.total_quests_completed >= badge.requirement_value;
      case "challenge_wins":
        return await checkChallengeWins(badge.requirement_value);
      case "referrals":
        return await checkReferrals(badge.requirement_value);
      default:
        return false;
    }
  };

  const checkChallengeWins = async (requiredWins: number): Promise<boolean> => {
    try {
      const { count, error } = await supabase
        .from("challenge_participants")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("completed", true);

      if (error) throw error;
      return (count || 0) >= requiredWins;
    } catch (error) {
      console.error("Error checking challenge wins:", error);
      return false;
    }
  };

  const checkReferrals = async (requiredReferrals: number): Promise<boolean> => {
    try {
      const { count, error } = await supabase
        .from("referrals")
        .select("*", { count: "exact", head: true })
        .eq("referrer_id", userId)
        .in("status", ["day_1_completed", "rewarded"]);

      if (error) throw error;
      return (count || 0) >= requiredReferrals;
    } catch (error) {
      console.error("Error checking referrals:", error);
      return false;
    }
  };

  const awardBadges = async (badges: BadgeType[]) => {
    try {
      // Filter out badges that might already be earned (double-check)
      const badgesToInsert = badges.filter(b => !earnedBadges.has(b.id));
      
      if (badgesToInsert.length === 0) return;

      const inserts = badgesToInsert.map((badge) => ({
        user_id: userId,
        badge_id: badge.id,
      }));

      const { error } = await supabase
        .from("user_badges")
        .insert(inserts)
        .select();

      // Ignore duplicate key errors (23505) - badge already exists
      if (error && !error.message?.includes('duplicate key') && error.code !== '23505') {
        throw error;
      }

      // Update local state only for successfully inserted badges
      const newEarned = new Set(earnedBadges);
      badgesToInsert.forEach((badge) => {
        newEarned.add(badge.id);
      });
      setEarnedBadges(newEarned);
      
      // Queue badges for modal display
      setBadgeQueue(prev => [...prev, ...badgesToInsert]);
      
      // Trigger first badge celebration if this is the first badge
      if (earnedBadges.size === 0 && badgesToInsert.length > 0 && onFirstBadgeUnlock) {
        setTimeout(() => onFirstBadgeUnlock(), 1000);
      }
    } catch (error) {
      console.error("Error awarding badges:", error);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-muted rounded w-1/3 mb-4" />
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 w-20 bg-muted rounded-lg" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  const earnedBadgesList = allBadges.filter((b) => earnedBadges.has(b.id));
  const lockedBadges = allBadges.filter((b) => !earnedBadges.has(b.id));
  
  // Separate mystery/hidden badges and premium badges
  const mysteryBadges = earnedBadgesList.filter(
    b => b.requirement_type === 'mystery_random' || b.requirement_type === 'hidden_achievement'
  );
  const premiumBadges = earnedBadgesList.filter(b => b.is_premium_only);
  const regularBadges = earnedBadgesList.filter(
    b => b.requirement_type !== 'mystery_random' 
    && b.requirement_type !== 'hidden_achievement' 
    && !b.is_premium_only
  );

  return (
    <>
      <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-primary/20">
        <h2 className="text-2xl font-bold mb-4">Your Badges</h2>

        {earnedBadgesList.length === 0 && (
          <p className="text-muted-foreground text-center py-8">
            Complete quests to earn badges! 🏆
          </p>
        )}

        {/* Regular Badges */}
        {regularBadges.length > 0 && (
          <>
            <h3 className="text-lg font-semibold mb-3">Achievement Badges</h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 mb-6">
              {regularBadges.map((badge) => (
                <div
                  key={badge.id}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20 hover:scale-105 transition-transform cursor-pointer"
                  title={`${badge.name}: ${badge.description}`}
                >
                  <span className="text-4xl">{badge.icon}</span>
                  <span className="text-xs font-medium text-center leading-tight">
                    {badge.name}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Premium Exclusive Badges */}
        {premiumBadges.length > 0 && (
          <>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <span>Premium Badges</span>
              <span className="text-xs px-2 py-1 rounded-full bg-gold/20 text-gold border border-gold/30">
                💎 Exclusive
              </span>
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 mb-6">
              {premiumBadges.map((badge) => (
                <div
                  key={badge.id}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg bg-gradient-to-br from-gold/20 via-accent/10 to-gold/20 border-2 border-gold/50 hover:scale-105 transition-transform cursor-pointer relative"
                  title={`${badge.name}: ${badge.description}`}
                >
                  {/* Gold glow effect */}
                  <div className="absolute inset-0 bg-gold/20 blur-xl rounded-lg -z-10" />
                  <span className="text-4xl">{badge.icon}</span>
                  <span className="text-xs font-medium text-center leading-tight">
                    {badge.name}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Mystery & Hidden Achievement Badges */}
        {mysteryBadges.length > 0 && (
          <>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <span>Mystery Badges</span>
              <span className="text-sm font-normal text-muted-foreground">(Rare)</span>
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 mb-6">
              {mysteryBadges.map((badge) => (
                <div
                  key={badge.id}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg bg-gradient-to-br from-primary/20 via-accent/10 to-primary/20 border-2 border-primary/40 hover:scale-105 transition-transform cursor-pointer relative animate-pulse"
                  title={`${badge.name}: ${badge.description}`}
                >
                  {/* Glow effect */}
                  <div className="absolute inset-0 bg-primary/10 blur-xl rounded-lg -z-10 animate-pulse" />
                  <span className="text-4xl">{badge.icon}</span>
                  <span className="text-xs font-medium text-center leading-tight">
                    {badge.name}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {lockedBadges.length > 0 && (
          <>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Locked Badges
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
              {lockedBadges.slice(0, 6).map((badge) => (
                <div
                  key={badge.id}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/30 border border-muted opacity-50 hover:opacity-70 transition-opacity cursor-pointer"
                  title={
                    badge.requirement_type === 'mystery_random' || badge.requirement_type === 'hidden_achievement'
                      ? `${badge.name}: ${badge.description} (Hidden)`
                      : `${badge.name}: ${badge.description} (Requirement: ${badge.requirement_value} ${badge.requirement_type})`
                  }
                >
                  <span className="text-4xl grayscale">{badge.icon}</span>
                  <span className="text-xs text-center leading-tight text-muted-foreground">
                    {badge.requirement_type === 'mystery_random' || badge.requirement_type === 'hidden_achievement' ? '???' : badge.name}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
      
      {currentUnlockedBadge && (
        <BadgeUnlockModal
          open={badgeModalOpen}
          onOpenChange={setBadgeModalOpen}
          badgeName={currentUnlockedBadge.name}
          badgeIcon={currentUnlockedBadge.icon}
          badgeDescription={currentUnlockedBadge.description}
        />
      )}
    </>
  );
};
