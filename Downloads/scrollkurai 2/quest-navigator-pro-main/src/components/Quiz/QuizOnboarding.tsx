import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface QuizQuestion {
  question: string;
  options: { text: string; score: number }[];
}

const quizQuestions: QuizQuestion[] = [
  {
    question: "When you wake up, how quickly do you reach for your phone?",
    options: [
      { text: "Within 2 minutes", score: 5 },
      { text: "Within 5–10 minutes", score: 3 },
      { text: "After I settle myself", score: 2 },
      { text: "I avoid checking early mornings", score: 1 },
    ],
  },
  {
    question: "How often does scrolling change your mood?",
    options: [
      { text: "Very often — I feel what I see", score: 5 },
      { text: "Sometimes — depends on the content", score: 3 },
      { text: "Rarely — I stay neutral", score: 2 },
      { text: "Never — I'm in full control", score: 1 },
    ],
  },
  {
    question: "Does social media make you compare your life with others?",
    options: [
      { text: "Yes, almost every day", score: 5 },
      { text: "Sometimes", score: 3 },
      { text: "Rarely", score: 2 },
      { text: "No, not really", score: 1 },
    ],
  },
  {
    question: "How does social media affect your sleep or night routine?",
    options: [
      { text: "I lose sleep scrolling", score: 5 },
      { text: "I scroll until I fall asleep", score: 4 },
      { text: "I scroll a bit but manage it", score: 2 },
      { text: "No impact at all", score: 1 },
    ],
  },
  {
    question: "If social media disappeared for 24 hours, how would you feel?",
    options: [
      { text: "Anxious or disconnected", score: 5 },
      { text: "A little uneasy", score: 3 },
      { text: "Neutral", score: 2 },
      { text: "Relieved and free", score: 1 },
    ],
  },
];

const archetypes = [
  { name: "True Potential Seeker", minScore: 5, maxScore: 8, description: "You're already on the path to greatness! 🌟" },
  { name: "Focus Initiator", minScore: 9, maxScore: 12, description: "You've got the basics down, time to level up! 🚀" },
  { name: "Balanced Thinker", minScore: 13, maxScore: 16, description: "You're in the middle zone - potential unlocking! ⚖️" },
  { name: "Mind Wanderer", minScore: 17, maxScore: 20, description: "Your focus needs work, but you're aware! 🌊" },
  { name: "Certified Brain Rotter", minScore: 21, maxScore: 25, description: "Time for a serious transformation! 💀➡️🧠" },
];

interface QuizOnboardingProps {
  open: boolean;
  userId: string;
  onComplete: () => void;
}

export const QuizOnboarding = ({ open, userId, onComplete }: QuizOnboardingProps) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleAnswer = (score: number) => {
    const newScore = totalScore + score;
    setTotalScore(newScore);

    if (currentQuestion < quizQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setShowResults(true);
    }
  };

  const getArchetype = (score: number) => {
    return archetypes.find(a => score >= a.minScore && score <= a.maxScore) || archetypes[4];
  };

  const handleComplete = async () => {
    setSubmitting(true);
    const archetype = getArchetype(totalScore);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          archetype: archetype.name,
          brain_rot_score: totalScore,
          quiz_completed: true,
        })
        .eq("id", userId);

      if (error) {
        console.error("Error updating profile:", error);
        toast.error("Failed to save results");
        return;
      }

      toast.success(`Welcome, ${archetype.name}!`, {
        description: "Your journey begins now!",
      });

      onComplete();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to complete quiz");
    } finally {
      setSubmitting(false);
    }
  };

  const progress = ((currentQuestion + 1) / quizQuestions.length) * 100;
  const archetype = getArchetype(totalScore);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[500px]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-2xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Brain Rot Assessment
          </DialogTitle>
          <DialogDescription>
            Answer honestly to discover your starting archetype
          </DialogDescription>
        </DialogHeader>

        {!showResults ? (
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Question {currentQuestion + 1} of {quizQuestions.length}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-primary/20">
              <h3 className="text-lg font-medium mb-4">
                {quizQuestions[currentQuestion].question}
              </h3>
              <div key={currentQuestion} className="space-y-3">
                {quizQuestions[currentQuestion].options.map((option, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="w-full justify-start text-left h-auto py-3 px-4 hover:bg-primary/10 hover:border-primary transition-all"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      handleAnswer(option.score);
                    }}
                  >
                    {option.text}
                  </Button>
                ))}
              </div>
            </Card>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <Card className="p-6 bg-gradient-to-br from-primary/20 to-accent/20 border-primary/40">
              <div className="text-center space-y-4">
                <div className="text-6xl mb-4">
                  {archetype.name === "Certified Brain Rotter" ? "💀" :
                   archetype.name === "Mind Wanderer" ? "🌊" :
                   archetype.name === "Balanced Thinker" ? "⚖️" :
                   archetype.name === "Focus Initiator" ? "🚀" : "🌟"}
                </div>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  {archetype.name}
                </h3>
                <p className="text-lg text-muted-foreground">
                  {archetype.description}
                </p>
                <div className="pt-4 space-y-2">
                  <p className="text-sm font-medium">Brain Rot Score: {totalScore}/25</p>
                  <Progress value={(totalScore / 25) * 100} className="h-2" />
                </div>
              </div>
            </Card>
            <Button
              onClick={handleComplete}
              disabled={submitting}
              className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
              size="lg"
            >
              {submitting ? "Saving..." : "Begin Your Journey"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
