import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Brain, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const ArchetypeProgress = () => {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (data) setProfile(data);
  };

  const nextLevelXp = (profile?.level || 1) * 100;
  const xpProgress = ((profile?.xp || 0) / nextLevelXp) * 100;

  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Brain className="w-5 h-5 text-primary" />
        Your Journey
      </h2>

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Current Archetype</span>
            <span className="text-sm text-primary font-semibold">{profile?.archetype}</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Level {profile?.level}</span>
            <span className="text-sm text-muted-foreground">
              {profile?.xp || 0} / {nextLevelXp} XP
            </span>
          </div>
          <Progress value={xpProgress} className="h-2" />
        </div>

        <div className="pt-4 border-t">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Target className="w-4 h-4" />
            <span>Keep completing quests to evolve your archetype and unlock new abilities!</span>
          </div>
        </div>
      </div>
    </Card>
  );
};
