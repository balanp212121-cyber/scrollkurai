import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Swords, Brain, User, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { QuickActionMenu } from "./QuickActionMenu";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Swords, label: "Compete", path: "/compete" },
  { icon: Brain, label: "Insights", path: "/insights" },
  { icon: User, label: "Profile", path: "/profile" },
];

export function MobileNav() {
  const location = useLocation();
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border/50">
        <div className="relative flex items-center justify-around h-20 max-w-lg mx-auto px-6">
          {/* Left 2 items */}
          {navItems.slice(0, 2).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 transition-all duration-300",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("w-6 h-6", isActive && "drop-shadow-[0_0_12px_hsl(var(--primary))]")} />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}

          {/* Center FAB - Build Button */}
          <button
            onClick={() => setQuickMenuOpen(true)}
            className="relative -top-6 flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary via-primary to-accent shadow-[0_0_30px_hsl(var(--primary)/0.5)] hover:shadow-[0_0_40px_hsl(var(--primary)/0.7)] transition-all duration-300 hover:scale-110 active:scale-95"
          >
            <Plus className="w-8 h-8 text-primary-foreground" />
          </button>

          {/* Right 2 items */}
          {navItems.slice(2).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 transition-all duration-300",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("w-6 h-6", isActive && "drop-shadow-[0_0_12px_hsl(var(--primary))]")} />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <QuickActionMenu open={quickMenuOpen} onOpenChange={setQuickMenuOpen} />
    </>
  );
}
