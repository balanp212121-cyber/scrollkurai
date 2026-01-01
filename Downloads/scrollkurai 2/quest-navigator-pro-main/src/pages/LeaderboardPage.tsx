import { Leaderboard } from "@/components/Dashboard/Leaderboard";
import { Trophy } from "lucide-react";

export default function LeaderboardPage() {
  return (
    <div className="pb-20 space-y-6">
      <div className="flex items-center gap-3">
        <Trophy className="w-8 h-8 text-gold" />
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gold to-accent bg-clip-text text-transparent">
            Leaderboard
          </h1>
          <p className="text-sm text-muted-foreground">See how you rank among warriors</p>
        </div>
      </div>

      <Leaderboard />
    </div>
  );
}
