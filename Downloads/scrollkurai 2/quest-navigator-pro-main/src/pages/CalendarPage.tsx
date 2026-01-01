import { HabitCalendar } from "@/components/Dashboard/HabitCalendar";
import { Calendar } from "lucide-react";

export default function CalendarPage() {
  return (
    <div className="pb-20 space-y-6">
      <div className="flex items-center gap-3">
        <Calendar className="w-8 h-8 text-accent" />
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Habit Calendar
          </h1>
          <p className="text-sm text-muted-foreground">Visualize your consistency</p>
        </div>
      </div>

      <HabitCalendar />
    </div>
  );
}
