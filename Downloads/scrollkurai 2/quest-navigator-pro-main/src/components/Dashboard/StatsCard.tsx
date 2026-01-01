import { Card } from "@/components/ui/card";
import { Flame, Trophy, Zap } from "lucide-react";

interface StatsCardProps {
  streak: number;
  xp: number;
  level: number;
  totalQuests: number;
}

export const StatsCard = ({ streak, xp, level, totalQuests }: StatsCardProps) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="p-4 bg-gradient-to-br from-card to-card/50 border-primary/20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-lg">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Level</p>
            <p className="text-2xl font-bold text-primary">{level}</p>
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-gradient-to-br from-card to-card/50 border-gold/20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gold/20 rounded-lg">
            <Trophy className="w-5 h-5 text-gold" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total XP</p>
            <p className="text-2xl font-bold text-gold">{xp.toLocaleString()}</p>
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-gradient-to-br from-card to-card/50 border-destructive/20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-destructive/20 rounded-lg">
            <Flame className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Streak</p>
            <p className="text-2xl font-bold text-destructive">{streak} days</p>
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-gradient-to-br from-card to-card/50 border-accent/20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-accent/20 rounded-lg">
            <Trophy className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Quests</p>
            <p className="text-2xl font-bold text-accent">{totalQuests}</p>
          </div>
        </div>
      </Card>
    </div>
  );
};
