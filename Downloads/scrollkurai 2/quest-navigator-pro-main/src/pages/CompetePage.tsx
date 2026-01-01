import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Swords, Trophy, Users } from "lucide-react";
import ChallengesPage from "./ChallengesPage";
import LeaguesPage from "./LeaguesPage";
import TeamsPage from "./Teams/TeamsPage";

export default function CompetePage() {
  const [activeTab, setActiveTab] = useState("challenges");

  return (
    <div className="pb-20">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-3 mb-6">
          <TabsTrigger value="challenges" className="gap-2">
            <Swords className="w-4 h-4" />
            Challenges
          </TabsTrigger>
          <TabsTrigger value="leagues" className="gap-2">
            <Trophy className="w-4 h-4" />
            Leagues
          </TabsTrigger>
          <TabsTrigger value="teams" className="gap-2">
            <Users className="w-4 h-4" />
            Teams
          </TabsTrigger>
        </TabsList>

        <TabsContent value="challenges">
          <ChallengesPage />
        </TabsContent>

        <TabsContent value="leagues">
          <LeaguesPage />
        </TabsContent>

        <TabsContent value="teams">
          <TeamsPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
