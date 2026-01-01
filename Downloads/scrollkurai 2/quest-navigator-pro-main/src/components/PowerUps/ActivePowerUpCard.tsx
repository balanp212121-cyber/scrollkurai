import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, Zap } from "lucide-react";

interface PowerUp {
  id: string;
  name: string;
  description: string;
  icon: string;
  effect_type: string;
  effect_value: number;
}

interface ActivePowerUpCardProps {
  powerUp: PowerUp;
  activatedAt: Date;
  expiresAt: Date;
}

export function ActivePowerUpCard({ powerUp, activatedAt, expiresAt }: ActivePowerUpCardProps) {
  const [timeRemaining, setTimeRemaining] = useState("");
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const totalDuration = expiresAt.getTime() - activatedAt.getTime();
      const remaining = expiresAt.getTime() - now.getTime();

      if (remaining <= 0) {
        setTimeRemaining("Expired");
        setProgress(0);
        return;
      }

      // Calculate progress percentage
      const progressPercent = (remaining / totalDuration) * 100;
      setProgress(Math.max(0, Math.min(100, progressPercent)));

      // Format time remaining
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m remaining`);
      } else if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s remaining`);
      } else {
        setTimeRemaining(`${seconds}s remaining`);
      }
    };

    // Update immediately
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [activatedAt, expiresAt]);

  const isLowTime = progress < 20;
  const isMediumTime = progress >= 20 && progress < 50;

  return (
    <Card className={`p-4 border-l-4 ${
      isLowTime 
        ? 'border-l-destructive bg-destructive/5' 
        : isMediumTime 
          ? 'border-l-amber-500 bg-amber-500/5'
          : 'border-l-green-500 bg-green-500/5'
    }`}>
      <div className="flex items-center gap-4">
        <div className="text-3xl">{powerUp.icon}</div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">{powerUp.name}</h4>
            <Badge 
              variant="outline" 
              className={`${
                isLowTime 
                  ? 'border-destructive/50 text-destructive' 
                  : isMediumTime
                    ? 'border-amber-500/50 text-amber-500'
                    : 'border-green-500/50 text-green-500'
              }`}
            >
              <Clock className="w-3 h-3 mr-1" />
              {timeRemaining}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-accent/20 text-accent border-accent/30 text-xs">
              <Zap className="w-3 h-3 mr-1" />
              {powerUp.effect_type.replace('_', ' ')}
            </Badge>
            {powerUp.effect_value > 1 && (
              <span className="text-xs text-muted-foreground">
                {powerUp.effect_value}x multiplier
              </span>
            )}
          </div>
          <Progress 
            value={progress} 
            className={`h-1.5 ${
              isLowTime 
                ? '[&>div]:bg-destructive' 
                : isMediumTime
                  ? '[&>div]:bg-amber-500'
                  : '[&>div]:bg-green-500'
            }`}
          />
        </div>
      </div>
    </Card>
  );
}
