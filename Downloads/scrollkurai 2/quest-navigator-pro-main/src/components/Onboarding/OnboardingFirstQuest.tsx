import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, Loader2, ArrowRight, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface OnboardingFirstQuestProps {
  onNext: () => void;
}

export const OnboardingFirstQuest = ({ onNext }: OnboardingFirstQuestProps) => {
  const [quest, setQuest] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFirstQuest();
  }, []);

  const fetchFirstQuest = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('get-daily-quest', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });
      
      if (error) {
        console.error('Quest fetch error:', error);
        // Set a default quest if fetch fails
        setQuest({
          content: "Take a 5-minute break from your phone and do something you enjoy offline",
          reflection_prompt: "How did that feel?"
        });
      } else {
        setQuest(data.quest);
      }
    } catch (error) {
      console.error('Error fetching quest:', error);
      // Fallback quest
      setQuest({
        content: "Take a 5-minute break from your phone and do something you enjoy offline",
        reflection_prompt: "How did that feel?"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Trophy className="w-8 h-8 text-white" />
          </div>
        </div>
        <h2 className="text-3xl font-bold">Your First Quest</h2>
        <p className="text-muted-foreground">
          Complete daily quests to earn XP and unlock rewards
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card className="p-6 max-w-lg mx-auto bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              <span className="text-sm font-semibold text-primary">Your First Quest Preview</span>
            </div>
            
            <p className="text-lg font-medium">{quest?.content || "Loading quest..."}</p>
            
            <div className="pt-4 border-t border-border/50 space-y-3">
              <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">
                    📍 How to Complete This Quest:
                  </p>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Click "Got It, Let's Go!" below to go to your dashboard</li>
                    <li>Find this quest in the "Today's Quest" card</li>
                    <li>Complete the quest and reflect on your experience</li>
                    <li>Earn 50 XP and start your streak! 🎉</li>
                  </ol>
                </div>
              </div>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center cursor-help">
                      <span>This is just a preview - you'll complete it on the dashboard</span>
                      <Info className="w-3 h-3" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Quests can only be completed from your main dashboard. This preview shows you what to expect!</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </Card>
      )}

      <div className="flex justify-center pt-4">
        <Button onClick={onNext} size="lg" className="px-8 gap-2">
          Got It, Let's Go!
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
