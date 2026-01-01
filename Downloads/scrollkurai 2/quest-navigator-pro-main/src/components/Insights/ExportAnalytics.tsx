import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const ExportAnalytics = () => {
  const handleExportCSV = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data } = await supabase
      .from('user_analytics_daily')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (data) {
      const csv = [
        ['Date', 'XP Earned', 'Quests Completed', 'Time Saved (min)', 'Streak'].join(','),
        ...data.map(row => [
          row.date,
          row.xp_earned,
          row.quests_completed,
          row.time_saved_minutes,
          row.streak
        ].join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-growth-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      toast.success("Analytics exported!");
    }
  };

  const handleShare = () => {
    toast.info("Share feature coming soon!");
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold mb-4">Export & Share</h2>
      <div className="flex gap-3">
        <Button onClick={handleExportCSV} variant="outline" className="flex-1 gap-2">
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
        <Button onClick={handleShare} className="flex-1 gap-2">
          <Share2 className="w-4 h-4" />
          Share Progress
        </Button>
      </div>
    </Card>
  );
};
