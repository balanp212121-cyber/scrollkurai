import { useEffect, useState } from "react";
import { LeagueBanner } from "@/components/Leagues/LeagueBanner";
import { LeagueLeaderboard } from "@/components/Leagues/LeagueLeaderboard";
import { supabase } from "@/integrations/supabase/client";

export default function LeaguesPage() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser();
  }, []);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);
  };

  return (
    <div className="space-y-6">
      {userId && <LeagueBanner userId={userId} />}
      <LeagueLeaderboard />
    </div>
  );
}
