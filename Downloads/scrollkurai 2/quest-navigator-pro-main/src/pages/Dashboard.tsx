import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DailyQuestCard } from "@/components/Dashboard/DailyQuestCard";
import { StatsCard } from "@/components/Dashboard/StatsCard";
import { XPBar } from "@/components/Dashboard/XPBar";
import { BadgeDisplay } from "@/components/Dashboard/BadgeDisplay";
import { QuizOnboarding } from "@/components/Quiz/QuizOnboarding";
import { Leaderboard } from "@/components/Dashboard/Leaderboard";
import { ReferralCard } from "@/components/Referrals/ReferralCard";
import { StreakRecoveryCountdown } from "@/components/Streak/StreakRecoveryCountdown";
import { RenewalReminderBanner } from "@/components/Subscription/RenewalReminderBanner";
import { ActivePowerUpBanner } from "@/components/PowerUps/ActivePowerUpBanner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useTutorial } from "@/hooks/useTutorial";

import { TutorialTooltip } from "@/components/Tutorial/TutorialTooltip";
import { useNavigate } from "react-router-dom";
import { useMilestoneCelebration } from "@/hooks/useMilestoneCelebration";

interface Profile {
  id: string;
  username: string | null;
  archetype: string;
  xp: number;
  level: number;
  streak: number;
  total_quests_completed: number;
  quiz_completed: boolean;
  brain_rot_score: number;
  premium_status: boolean;
  streak_lost_at: string | null;
  last_streak_count: number | null;
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showQuestHighlight, setShowQuestHighlight] = useState(false);
  const [badgeCount, setBadgeCount] = useState(0);
  const { currentStep, isActive, nextStep, skipTutorial } = useTutorial();
  const { checkMilestones, celebrateFirstBadge } = useMilestoneCelebration(user?.id);
  const navigate = useNavigate();

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
        return;
      }

      if (data) {
        const profileData = data as Profile;
        setProfile(profileData);
        if (!profileData.quiz_completed) {
          setShowQuiz(true);
        }

        // Fetch badge count
        const { count } = await supabase
          .from("user_badges")
          .select("*", { count: 'exact', head: true })
          .eq("user_id", userId);

        const currentBadgeCount = count || 0;
        setBadgeCount(currentBadgeCount);

        // Check milestones for celebrations
        checkMilestones({
          badgeCount: currentBadgeCount,
          level: profileData.level,
          streak: profileData.streak,
        });
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
    }
  };

  useEffect(() => {
    // Check if user just completed onboarding
    const justCompletedOnboarding = localStorage.getItem('just_completed_onboarding');
    if (justCompletedOnboarding === 'true') {
      setShowQuestHighlight(true);
      localStorage.removeItem('just_completed_onboarding');
      // Auto-dismiss after 10 seconds
      setTimeout(() => setShowQuestHighlight(false), 10000);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleQuestComplete = async () => {
    if (user) {
      await fetchProfile(user.id);
      // Dismiss quest highlight after completion
      setShowQuestHighlight(false);

      // Check if this was the first quest and start tutorial
      const { count } = await supabase
        .from('user_quest_log')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('completed_at', 'is', null);

      // If user just completed their first quest, tutorial will auto-start via useTutorial hook
      if (count === 1) {
        // Trigger tutorial initialization by reloading
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    }
  };

  const handleQuizComplete = () => {
    setShowQuiz(false);
    if (user) {
      fetchProfile(user.id);
    }
  };

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-primary text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      {showQuiz && user && (
        <QuizOnboarding
          open={showQuiz}
          userId={user.id}
          onComplete={handleQuizComplete}
        />
      )}

      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Welcome Back, {profile.username || "Warrior"}
            </h1>
            <p className="text-sm text-muted-foreground">{profile.archetype}</p>
          </div>
        </div>

        {/* Active Power-Ups */}
        <ActivePowerUpBanner />
        <div className="relative">
          <StatsCard
            streak={profile.streak}
            xp={profile.xp}
            level={profile.level}
            totalQuests={profile.total_quests_completed}
          />

          {/* Tutorial: Insights */}
          {isActive && currentStep === 'insights' && (
            <TutorialTooltip
              title="Track Your Progress"
              description="View detailed insights about your journey, including 30-day charts, weekly summaries, and milestone achievements. Click the Insights tab to explore!"
              position="bottom"
              onNext={() => {
                nextStep();
                // Scroll to leaderboard
                setTimeout(() => {
                  document.getElementById('leaderboard-section')?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                  });
                }, 300);
              }}
              onSkip={skipTutorial}
              stepNumber={1}
              totalSteps={3}
            />
          )}
        </div>

        {/* XP Progress */}
        <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-primary/20">
          <XPBar currentXP={profile.xp} level={profile.level} />
        </Card>

        {/* Subscription Renewal Reminder */}
        <RenewalReminderBanner />

        {/* Streak Recovery Countdown */}
        {profile.streak_lost_at && profile.last_streak_count && (
          <StreakRecoveryCountdown
            userId={profile.id}
            streakLostAt={profile.streak_lost_at}
            lastStreakCount={profile.last_streak_count}
            onRecovered={() => fetchProfile(profile.id)}
          />
        )}

        {/* Daily Quest */}
        <div className="relative">
          <h2 className="text-2xl font-bold mb-4">Today's Quest</h2>

          {/* Highlight wrapper with pulse animation */}
          <div
            className={`relative ${showQuestHighlight ? 'animate-pulse-glow' : ''}`}
            onClick={() => setShowQuestHighlight(false)}
          >
            {showQuestHighlight && (
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 rounded-2xl blur-xl animate-pulse pointer-events-none" />
            )}

            {showQuestHighlight && (
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-bounce pointer-events-none z-10">
                <span className="text-4xl">👇</span>
                <span className="text-sm font-semibold text-primary bg-background px-3 py-1 rounded-full border-2 border-primary shadow-lg whitespace-nowrap">
                  Complete your first quest here!
                </span>
              </div>
            )}

            <div className="relative z-0">
              <DailyQuestCard onQuestComplete={handleQuestComplete} />
            </div>
          </div>
        </div>



        {/* Referrals */}
        <div id="invite-section" className="relative">
          <h2 className="text-2xl font-bold mb-4">Invite Friends</h2>
          <ReferralCard />

          {/* Tutorial: Invite Friends */}
          {isActive && currentStep === 'invite' && (
            <TutorialTooltip
              title="Grow Together"
              description="Share your referral code or QR code with friends! You'll earn 500 XP for each friend who completes their first quest. Plus, get exclusive badges for bringing friends along!"
              position="top"
              onNext={skipTutorial}
              onSkip={skipTutorial}
              isLastStep={true}
              stepNumber={3}
              totalSteps={3}
            />
          )}
        </div>

        {/* Badges */}
        <BadgeDisplay
          userId={profile.id}
          userStats={{
            xp: profile.xp,
            level: profile.level,
            streak: profile.streak,
            total_quests_completed: profile.total_quests_completed,
          }}
          isPremium={profile.premium_status}
          onFirstBadgeUnlock={celebrateFirstBadge}
        />

        {/* Leaderboard */}
        <div id="leaderboard-section" className="relative">
          <h2 className="text-2xl font-bold mb-4">Global Leaderboard</h2>
          <Leaderboard />

          {/* Tutorial: Leaderboard */}
          {isActive && currentStep === 'leaderboard' && (
            <TutorialTooltip
              title="Compete & Rise"
              description="See how you rank against other warriors! Complete quests to earn XP and climb the leaderboard. Join weekly leagues to compete for exclusive rewards and badges."
              position="top"
              onNext={() => {
                nextStep();
                // Scroll to invite section
                setTimeout(() => {
                  document.getElementById('invite-section')?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                  });
                }, 300);
              }}
              onSkip={skipTutorial}
              stepNumber={2}
              totalSteps={3}
            />
          )}
        </div>

        {/* Motivation */}
        <Card className="p-6 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
          <div className="text-center space-y-2">
            <p className="text-lg font-medium">
              "Every quest completed is a step away from brain rot."
            </p>
            <p className="text-sm text-muted-foreground">
              Keep building your streak and unlock your true potential!
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
