import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Sparkles, Zap, Flame } from "lucide-react";
import { ReflectionModal } from "./ReflectionModal";
import { toast } from "sonner";
import { isGoldenQuest } from "@/utils/surpriseRewards";

interface Quest {
  id: string;
  content: string;
  reflection_prompt: string;
  target_archetype: string | null;
}

interface DailyQuestCardProps {
  onQuestComplete: () => void;
}

export const DailyQuestCard = ({ onQuestComplete }: DailyQuestCardProps) => {
  const [quest, setQuest] = useState<Quest | null>(null);
  const [logId, setLogId] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [isGolden, setIsGolden] = useState(false);
  const [xpBoosterActive, setXpBoosterActive] = useState(false);

  const fetchDailyQuest = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Please sign in to view your quest");
        return;
      }

      // Pass local date for timezone-safe assignment
      // Pass local date for timezone-safe assignment (IST friendly)
      // uses YYYY-MM-DD format based on SYSTEM time, not UTC.
      const localDate = new Date().toLocaleDateString('en-CA');

      const { data, error } = await supabase.functions.invoke('get-daily-quest', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { date: localDate }
      });

      if (error) {
        console.error('Error fetching quest:', error);
        toast.error("Failed to load quest");
        return;
      }

      setQuest(data.quest);
      setLogId(data.log_id);
      setCompleted(data.completed);

      // Check if this is a golden quest
      const golden = await isGoldenQuest(session.user.id);
      setIsGolden(golden && !data.completed);

      // Check for active XP booster
      const { data: profile } = await supabase
        .from('profiles')
        .select('xp_booster_active, xp_booster_expires_at')
        .eq('id', session.user.id)
        .single();

      if (profile?.xp_booster_active && profile?.xp_booster_expires_at) {
        const now = new Date();
        const expiresAt = new Date(profile.xp_booster_expires_at);
        setXpBoosterActive(now < expiresAt);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error("Failed to load quest");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDailyQuest();
  }, []);

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-card via-card/90 to-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Loading Quest...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!quest) {
    return (
      <Card className="bg-gradient-to-br from-card via-card/90 to-destructive/5 border-destructive/20">
        <CardHeader>
          <CardTitle>No Quest Available</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Check back later for new quests!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={`bg-gradient-to-br transition-all duration-300 ${completed
        ? 'from-card via-card/90 to-accent/10 border-accent/30'
        : isGolden
          ? 'from-card via-amber-500/10 to-yellow-500/10 border-amber-500/40 hover:border-amber-500/60 shadow-lg shadow-amber-500/20'
          : 'from-card via-card/90 to-primary/5 border-primary/20 hover:border-primary/40'
        }`}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <CardTitle className="flex items-center gap-2">
              {isGolden ? (
                <Zap className="w-5 h-5 text-amber-500 animate-pulse" />
              ) : (
                <Sparkles className={`w-5 h-5 ${completed ? 'text-accent' : 'text-primary'}`} />
              )}
              {completed ? "Quest Complete!" : isGolden ? "✨ Golden Quest! (3x XP)" : "Today's Quest"}
            </CardTitle>
            {quest.target_archetype && (
              <Badge variant="secondary" className="text-xs">
                {quest.target_archetype}
              </Badge>
            )}
          </div>
          {xpBoosterActive && !completed && (
            <Badge className="bg-purple-500/20 text-purple-500 border-purple-500/30 animate-pulse">
              <Flame className="w-3 h-3 mr-1" />
              2× XP Active
            </Badge>
          )}
          {isGolden && !completed && (
            <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
              This rare opportunity gives you triple XP! ⚡
            </p>
          )}
          {xpBoosterActive && isGolden && !completed && (
            <p className="text-xs text-purple-500 font-medium">
              Combined with XP Booster = 6× XP total!
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`p-4 rounded-lg border ${isGolden
            ? 'bg-amber-500/5 border-amber-500/30'
            : 'bg-muted/50 border-border'
            }`}>
            <p className="text-lg font-medium">{quest.content}</p>
          </div>

          {completed ? (
            <div className="flex items-center gap-2 text-accent">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">Completed today!</span>
            </div>
          ) : (
            <Button
              onClick={() => setModalOpen(true)}
              className={`w-full ${isGolden
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white shadow-lg shadow-amber-500/30'
                : xpBoosterActive
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/30'
                  : 'bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90'
                }`}
              size="lg"
            >
              {isGolden
                ? (xpBoosterActive ? 'Complete Golden Quest & Earn 6× XP!' : 'Complete Golden Quest & Earn 3× XP!')
                : xpBoosterActive
                  ? 'Complete Quest & Earn 2× XP!'
                  : 'Complete Quest & Earn Rewards'
              }
            </Button>
          )}
        </CardContent>
      </Card>

      {!completed && quest && logId && (
        <ReflectionModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          quest={quest}
          logId={logId}
          isGoldenQuest={isGolden}
          onComplete={() => {
            setCompleted(true);
            setIsGolden(false);
            onQuestComplete();
          }}
        />
      )}
    </>
  );
};
