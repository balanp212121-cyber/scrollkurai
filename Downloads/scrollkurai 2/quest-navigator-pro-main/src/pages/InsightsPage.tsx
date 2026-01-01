import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Target } from "lucide-react";
import { WeeklySummaryCard } from "@/components/Insights/WeeklySummaryCard";
import { ThirtyDayCharts } from "@/components/Insights/ThirtyDayCharts";
import { ArchetypeProgress } from "@/components/Insights/ArchetypeProgress";
import { LeaderboardInsights } from "@/components/Insights/LeaderboardInsights";
import { ExportAnalytics } from "@/components/Insights/ExportAnalytics";
import PersonalizationPage from "./PersonalizationPage";

export default function InsightsPage() {
  const [activeTab, setActiveTab] = useState("growth");

  return (
    <div className="pb-20">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-2 mb-6">
          <TabsTrigger value="growth" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            My Growth
          </TabsTrigger>
          <TabsTrigger value="personalize" className="gap-2">
            <Target className="w-4 h-4" />
            Personalize
          </TabsTrigger>
        </TabsList>

        <TabsContent value="growth" className="space-y-6">
          <WeeklySummaryCard />
          <ThirtyDayCharts />
          <ArchetypeProgress />
          <LeaderboardInsights />
          <ExportAnalytics />
        </TabsContent>

        <TabsContent value="personalize">
          <PersonalizationPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
