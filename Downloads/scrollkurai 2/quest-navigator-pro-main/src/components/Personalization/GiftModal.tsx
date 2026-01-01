import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GiftModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recommendations: any[];
  userContext: any;
  onQuestsCreated: () => void;
}

export const GiftModal = ({
  open,
  onOpenChange,
  recommendations,
  userContext,
  onQuestsCreated,
}: GiftModalProps) => {
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClaimGift = async () => {
    setClaiming(true);
    setError(null);

    try {
      // Create all quests from recommendations
      const questPromises = recommendations.map(async (rec) => {
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
        return data;
      });

      await Promise.all(questPromises);

      toast.success(`${recommendations.length} quests accepted!`, {
        description: "Complete them to earn XP!"
      });

      onOpenChange(false);
      onQuestsCreated();
    } catch (err) {
      console.error("Error claiming quests:", err);
      setError("Failed to create quests. Please try again.");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[425px] border-2 border-primary/30 bg-gradient-to-br from-background via-primary/5 to-accent/5"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <VisuallyHidden>
          <DialogTitle>AI Quests Ready</DialogTitle>
          <DialogDescription>
            {recommendations.length} personalized quests have been generated for you
          </DialogDescription>
        </VisuallyHidden>
        <div className="flex flex-col items-center justify-center py-8 space-y-6">
          <motion.div
            initial={{ scale: 0, rotate: 0 }}
            animate={{ 
              scale: [1, 1.2, 1],
              rotate: [0, 10, -10, 0],
            }}
            transition={{ 
              duration: 1,
              repeat: Infinity,
              repeatDelay: 0.5,
            }}
            className="text-8xl"
          >
            🎁
          </motion.div>

          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              AI Quests Ready!
            </h2>
            
            <p className="text-muted-foreground max-w-xs">
              {recommendations.length} personalized quests have been generated for you
            </p>

            {error && (
              <p className="text-sm text-destructive mt-2">
                {error}
              </p>
            )}

            <div className="pt-4 space-y-2">
              <Button
                onClick={handleClaimGift}
                disabled={claiming}
                className="w-full"
                size="lg"
              >
                {claiming ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Claiming...
                  </>
                ) : (
                  <>
                    Claim Gift
                    <span className="ml-2">✨</span>
                  </>
                )}
              </Button>
              
              <Button
                onClick={() => onOpenChange(false)}
                variant="ghost"
                disabled={claiming}
                className="w-full"
              >
                View Later
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
