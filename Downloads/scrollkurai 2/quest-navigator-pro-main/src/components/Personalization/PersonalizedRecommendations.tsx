import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Target, Clock, Trophy, Loader2, RefreshCw, Crown, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ReflectionModal } from "@/components/Dashboard/ReflectionModal";
import confetti from "canvas-confetti";
import { GiftModal } from "./GiftModal";
import { useNavigate } from "react-router-dom";

interface Recommendation {
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  estimatedTime: string;
  xpReward: number;
  reasoning: string;
}

interface AcceptedQuest {
  id: string;
  quest_id: string;
  assigned_at: string;
  completed_at: string | null;
  quests: {
    content: string;
    reflection_prompt: string;
  };
}

interface PersonalizedRecommendationsProps {
  onRefresh?: () => void;
}

export const PersonalizedRecommendations = ({ onRefresh }: PersonalizedRecommendationsProps) => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [userContext, setUserContext] = useState<any>(null);
  const [acceptedQuests, setAcceptedQuests] = useState<AcceptedQuest[]>([]);
  const [acceptingIndex, setAcceptingIndex] = useState<number | null>(null);
  const [selectedQuest, setSelectedQuest] = useState<AcceptedQuest | null>(null);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [monthlyLimitReached, setMonthlyLimitReached] = useState(false);
  const [nextAvailableDate, setNextAvailableDate] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [usedThisMonth, setUsedThisMonth] = useState(0);
  const navigate = useNavigate();

  // Usage indicator component with responsive breakpoints
  const UsageIndicator = ({ compact = false }: { compact?: boolean }) => {
    if (isPremium) {
      return (
        <div className={`flex items-center gap-1.5 sm:gap-2 ${compact ? 'px-2 py-1' : 'px-2 sm:px-3 py-1 sm:py-1.5'} rounded-full bg-yellow-500/10 border border-yellow-500/20`}>
          <Crown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-500 shrink-0" />
          <span className="text-xs sm:text-sm font-medium text-yellow-600 whitespace-nowrap">Unlimited</span>
        </div>
      );
    }
    
    const remaining = Math.max(0, 1 - usedThisMonth);
    return (
      <div className={`flex items-center gap-1.5 sm:gap-2 ${compact ? 'px-2 py-1' : 'px-2 sm:px-3 py-1 sm:py-1.5'} rounded-full border ${
        remaining > 0 
          ? 'bg-primary/10 border-primary/20' 
          : 'bg-muted border-muted-foreground/20'
      }`}>
        <Sparkles className={`h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 ${remaining > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
        <span className={`text-xs sm:text-sm font-medium whitespace-nowrap ${remaining > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
          {remaining}/1 remaining
        </span>
      </div>
    );
  };

  // Check usage status and fetch accepted quests on mount
  useEffect(() => {
    const initialize = async () => {
      setInitialLoading(true);
      await Promise.all([checkMonthlyUsage(), fetchAcceptedQuests()]);
      setInitialLoading(false);
    };
    initialize();
  }, []);

  const checkMonthlyUsage = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if premium
      const { data: profile } = await supabase
        .from('profiles')
        .select('premium_status')
        .eq('id', user.id)
        .single();

      if (profile?.premium_status) {
        setIsPremium(true);
        return true; // Can generate
      }

      // Check monthly usage
      const currentMonth = new Date().toISOString().slice(0, 7);
      const { data: usage } = await supabase
        .from('ai_goal_usage')
        .select('id')
        .eq('user_id', user.id)
        .eq('goal_month', currentMonth);

      const usageCount = usage?.length || 0;
      setUsedThisMonth(usageCount);

      if (usageCount > 0) {
        setMonthlyLimitReached(true);
        const nextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
        setNextAvailableDate(nextMonth.toLocaleDateString());
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error checking monthly usage:", error);
      return true;
    }
  };

  const fetchRecommendations = async () => {
    // Check if user can generate
    const canGenerate = await checkMonthlyUsage();
    if (!canGenerate && !isPremium) {
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-personalized-quests');

      if (error) {
        console.error("Recommendations error:", error);
        
        // Handle monthly limit error
        if (error.message?.includes('403') || error.message?.includes('MONTHLY_LIMIT')) {
          setMonthlyLimitReached(true);
          const nextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
          setNextAvailableDate(nextMonth.toLocaleDateString());
          toast.error("Monthly limit reached", {
            description: "Upgrade to Premium for unlimited AI quests!"
          });
          return;
        }
        
        if (error.message?.includes('429')) {
          toast.error("Rate limit exceeded. Please try again in a few minutes.");
        } else if (error.message?.includes('402')) {
          toast.error("AI credits exhausted. Please add credits to continue.");
        } else if (error.message?.includes('parse')) {
          toast.error("Failed to process AI response. Please try again.", {
            description: "The AI service returned an unexpected format."
          });
        } else {
          toast.error("Failed to generate recommendations. Please try again.");
        }
        return;
      }

      // Check if response contains limit error
      if (data?.code === 'MONTHLY_LIMIT') {
        setMonthlyLimitReached(true);
        setNextAvailableDate(new Date(data.nextAvailable).toLocaleDateString());
        return;
      }

      setRecommendations(data.recommendations || []);
      setUserContext(data.userContext);
      setIsPremium(data.userContext?.isPremium || false);
      
      if (data.recommendations?.length > 0) {
        // Trigger confetti
        setTimeout(() => {
          const duration = 2000;
          const end = Date.now() + duration;

          const frame = () => {
            confetti({
              particleCount: 3,
              angle: 60,
              spread: 55,
              origin: { x: 0 },
              colors: ['#FFD700', '#FFA500', '#FF6347'],
              zIndex: 9999,
            });
            confetti({
              particleCount: 3,
              angle: 120,
              spread: 55,
              origin: { x: 1 },
              colors: ['#FFD700', '#FFA500', '#FF6347'],
              zIndex: 9999,
            });

            if (Date.now() < end) {
              requestAnimationFrame(frame);
            }
          };

          frame();
        }, 100);
        
        // Show gift modal
        setShowGiftModal(true);
      }
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      toast.error("Failed to generate recommendations");
    } finally {
      setLoading(false);
    }
  };

  const fetchAcceptedQuests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_quest_log')
        .select('*, quests(*)')
        .eq('user_id', user.id)
        .is('completed_at', null)
        .order('assigned_at', { ascending: false });

      if (error) throw error;
      setAcceptedQuests(data || []);
    } catch (error) {
      console.error("Error fetching accepted quests:", error);
    }
  };

  const handleAcceptQuest = async (rec: Recommendation, index: number) => {
    setAcceptingIndex(index);
    try {
      const { data, error } = await supabase.functions.invoke('accept-personalized-quest', {
        body: {
          questData: {
            title: rec.title,
            reflectionPrompt: `Reflect on how completing "${rec.title}" helped you. ${rec.description}`,
            archetype: userContext?.archetype || 'Mind Wanderer'
          }
        }
      });

      if (error) throw error;

      toast.success(`Quest accepted: ${rec.title}`, {
        description: "Complete it to earn XP!"
      });

      await fetchAcceptedQuests();
    } catch (error) {
      console.error("Error accepting quest:", error);
      toast.error("Failed to accept quest");
    } finally {
      setAcceptingIndex(null);
    }
  };

  // Removed duplicate useEffect - the one at line 51 handles initialization

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy": return "bg-green-500/10 text-green-500";
      case "medium": return "bg-yellow-500/10 text-yellow-500";
      case "hard": return "bg-red-500/10 text-red-500";
      default: return "bg-muted text-muted-foreground";
    }
  };

  // Initial loading state
  if (initialLoading) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </Card>
    );
  }

  if (loading && recommendations.length === 0) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div className="text-center">
            <h3 className="font-semibold text-lg">Generating Your Personalized Quests...</h3>
            <p className="text-sm text-muted-foreground mt-1">
              AI is analyzing your patterns and goals
            </p>
          </div>
        </div>
      </Card>
    );
  }

  // Monthly limit reached for free users
  if (monthlyLimitReached && !isPremium) {
    return (
      <Card className="p-8 border-primary/30 bg-gradient-to-br from-background via-primary/5 to-accent/5">
        <div className="text-center space-y-4">
          <div className="relative mx-auto w-fit">
            <Lock className="h-12 w-12 text-muted-foreground" />
            <Crown className="h-6 w-6 text-yellow-500 absolute -top-2 -right-2" />
          </div>
          <div className="flex justify-center">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-muted-foreground/20">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">0/1 remaining</span>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-lg">Monthly Limit Reached</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Free users can generate AI quests once per month.
            </p>
            {nextAvailableDate && (
              <p className="text-sm text-muted-foreground">
                Next available: <span className="font-medium text-primary">{nextAvailableDate}</span>
              </p>
            )}
          </div>
          <Button 
            onClick={() => navigate('/premium')}
            className="gap-2"
          >
            <Crown className="h-4 w-4" />
            Upgrade to Premium
          </Button>
          <p className="text-xs text-muted-foreground">
            Unlock unlimited AI-powered quests
          </p>
        </div>
      </Card>
    );
  }

  if (recommendations.length === 0 && !loading) {
    return (
      <Card className="p-8">
        <div className="text-center space-y-4">
          <Sparkles className="h-12 w-12 mx-auto text-primary" />
          <div>
            <h3 className="font-semibold text-lg">AI-Powered Quest Recommendations</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {isPremium 
                ? "Generate unlimited personalized quests tailored to your goals"
                : "Free users get 1 AI quest generation per month"}
            </p>
          </div>
          <div className="flex justify-center">
            <UsageIndicator />
          </div>
          <Button 
            onClick={fetchRecommendations}
            disabled={loading}
            className="gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate AI Quests
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Accepted Quests Section */}
      {acceptedQuests.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Your Active Quests</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {acceptedQuests.map((quest) => (
              <Card key={quest.id} className="p-4 space-y-3 border-primary/50">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-lg leading-tight">{quest.quests.content}</h3>
                  <Badge className="bg-primary/10 text-primary">Active</Badge>
                </div>
                <Button 
                  className="w-full"
                  onClick={() => setSelectedQuest(quest)}
                >
                  Complete Quest
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* AI Recommendations Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
            <h2 className="text-lg sm:text-xl font-bold">AI Recommendations</h2>
            {userContext && (
              <Badge variant="outline" className="text-xs sm:text-sm">
                {userContext.archetype} • Level {userContext.level}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <UsageIndicator compact />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchRecommendations();
                fetchAcceptedQuests();
                onRefresh?.();
              }}
              disabled={loading || (monthlyLimitReached && !isPremium)}
              className="h-8 w-8 p-0 sm:h-9 sm:w-9"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {recommendations.map((rec, index) => (
                <Card key={index} className="p-4 space-y-3 hover:border-primary/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-lg leading-tight">{rec.title}</h3>
                    <Badge className={getDifficultyColor(rec.difficulty)}>
                      {rec.difficulty}
                    </Badge>
                  </div>

                  <p className="text-sm text-muted-foreground">{rec.description}</p>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {rec.estimatedTime}
                    </div>
                    <div className="flex items-center gap-1 text-primary">
                      <Trophy className="h-4 w-4" />
                      {rec.xpReward} XP
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground italic">
                      💡 {rec.reasoning}
                    </p>
                  </div>

                  <Button 
                    className="w-full"
                    onClick={() => handleAcceptQuest(rec, index)}
                    disabled={acceptingIndex === index}
                  >
                    {acceptingIndex === index ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Accepting...
                      </>
                    ) : (
                      "Accept Quest"
                    )}
                  </Button>
                </Card>
              ))}
        </div>
      </div>

      {/* Gift Modal */}
      <GiftModal
        open={showGiftModal}
        onOpenChange={setShowGiftModal}
        recommendations={recommendations}
        userContext={userContext}
        onQuestsCreated={() => {
          fetchAcceptedQuests();
          onRefresh?.();
        }}
      />

      {/* Reflection Modal */}
      {selectedQuest && (
        <ReflectionModal
          open={!!selectedQuest}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedQuest(null);
              fetchAcceptedQuests();
              onRefresh?.();
            }
          }}
          quest={{
            id: selectedQuest.quest_id,
            content: selectedQuest.quests.content,
            reflection_prompt: selectedQuest.quests.reflection_prompt
          }}
          logId={selectedQuest.id}
          isGoldenQuest={false}
          onComplete={() => {
            setSelectedQuest(null);
            fetchAcceptedQuests();
            onRefresh?.();
          }}
        />
      )}
    </div>
  );
};