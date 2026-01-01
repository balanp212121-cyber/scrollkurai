import { LoginForm } from "@/components/Auth/LoginForm";
import { SignupForm } from "@/components/Auth/SignupForm";
import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { useState } from "react";

export default function AuthPage() {
  const [isSignup, setIsSignup] = useState(false);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              ScrollKurai
            </h1>
          </div>
          <p className="text-lg">
            Stop mindless scrolling. Start building the life you actually want.
          </p>
          <p className="text-xl text-muted-foreground">
            Transform Brain Rot → True Potential
          </p>
          <p className="text-sm text-muted-foreground">
            Gamified self-improvement through daily quests
          </p>
        </div>
        <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/20">
          {isSignup ? (
            <SignupForm onToggleMode={() => setIsSignup(false)} />
          ) : (
            <LoginForm onToggleMode={() => setIsSignup(true)} />
          )}
        </Card>
      </div>
    </div>
  );
}
