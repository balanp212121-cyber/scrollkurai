import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, ArrowRight, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TutorialTooltipProps {
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  onNext: () => void;
  onSkip: () => void;
  isLastStep?: boolean;
  stepNumber: number;
  totalSteps: number;
}

export const TutorialTooltip = ({
  title,
  description,
  position,
  onNext,
  onSkip,
  isLastStep = false,
  stepNumber,
  totalSteps,
}: TutorialTooltipProps) => {
  const positionClasses = {
    top: 'bottom-full mb-4 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-4 left-1/2 -translate-x-1/2',
    left: 'right-full mr-4 top-1/2 -translate-y-1/2',
    right: 'left-full ml-4 top-1/2 -translate-y-1/2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-primary',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-primary',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-8 border-b-8 border-l-8 border-t-transparent border-b-transparent border-l-primary',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-8 border-b-8 border-r-8 border-t-transparent border-b-transparent border-r-primary',
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
        className={`absolute z-50 ${positionClasses[position]}`}
      >
        <Card className="w-80 p-4 bg-gradient-to-br from-primary/10 via-card to-accent/5 border-primary shadow-2xl shadow-primary/20">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                <h3 className="font-bold text-foreground">{title}</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 -mt-1 -mr-1"
                onClick={onSkip}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">{description}</p>

            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <span className="text-xs text-muted-foreground">
                Step {stepNumber} of {totalSteps}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSkip}
                  className="text-xs"
                >
                  Skip Tour
                </Button>
                <Button
                  size="sm"
                  onClick={onNext}
                  className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-xs gap-1"
                >
                  {isLastStep ? "Finish" : "Next"}
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        </Card>
        
        {/* Arrow pointer */}
        <div className={`absolute w-0 h-0 ${arrowClasses[position]}`} />
      </motion.div>
    </AnimatePresence>
  );
};
