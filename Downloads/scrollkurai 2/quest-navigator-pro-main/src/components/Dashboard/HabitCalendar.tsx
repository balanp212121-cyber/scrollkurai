import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, subMonths } from "date-fns";
import { cn } from "@/lib/utils";

interface QuestLog {
  completed_at: string;
}

export function HabitCalendar() {
  const [completedDates, setCompletedDates] = useState<Date[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    fetchCompletedQuests();
  }, [currentMonth]);

  const fetchCompletedQuests = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    const { data } = await (supabase as any)
      .from("user_quest_log")
      .select("completed_at")
      .eq("user_id", user.id)
      .not("completed_at", "is", null)
      .gte("completed_at", monthStart.toISOString())
      .lte("completed_at", monthEnd.toISOString());

    if (data) {
      setCompletedDates(data.map((log: QuestLog) => new Date(log.completed_at)));
    }
  };

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const getIntensity = (day: Date) => {
    const completed = completedDates.filter((date) => isSameDay(date, day));
    if (completed.length === 0) return 0;
    return Math.min(completed.length, 4);
  };

  const intensityColors = [
    "bg-muted",
    "bg-primary/20",
    "bg-primary/40",
    "bg-primary/60",
    "bg-primary",
  ];

  return (
    <Card className="p-6 bg-card/50 border-primary/20">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">{format(currentMonth, "MMMM yyyy")}</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="px-3 py-1 text-sm bg-primary/10 hover:bg-primary/20 rounded-md transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="px-3 py-1 text-sm bg-primary/10 hover:bg-primary/20 rounded-md transition-colors"
            >
              Today
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="text-center text-xs text-muted-foreground font-medium p-2">
              {day}
            </div>
          ))}
          
          {/* Empty cells for days before month starts */}
          {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {/* Calendar days */}
          {daysInMonth.map((day) => {
            const intensity = getIntensity(day);
            const isToday = isSameDay(day, new Date());
            
            return (
              <div
                key={day.toString()}
                className={cn(
                  "aspect-square flex items-center justify-center rounded-md transition-all cursor-pointer hover:scale-110",
                  intensityColors[intensity],
                  isToday && "ring-2 ring-accent"
                )}
                title={`${format(day, "MMM d")}: ${intensity > 0 ? `${intensity} quest(s) completed` : "No quests"}`}
              >
                <span className={cn(
                  "text-xs font-medium",
                  intensity === 0 ? "text-muted-foreground" : "text-foreground"
                )}>
                  {format(day, "d")}
                </span>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
          <span className="text-xs text-muted-foreground">Less</span>
          {intensityColors.map((color, i) => (
            <div key={i} className={cn("w-4 h-4 rounded-sm", color)} />
          ))}
          <span className="text-xs text-muted-foreground">More</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
          <div>
            <p className="text-sm text-muted-foreground">This Month</p>
            <p className="text-2xl font-bold text-primary">{completedDates.length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Completion Rate</p>
            <p className="text-2xl font-bold text-accent">
              {Math.round((completedDates.length / daysInMonth.length) * 100)}%
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
