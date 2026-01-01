import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Users, UserPlus, PenLine, Target, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface QuickActionMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickActionMenu({ open, onOpenChange }: QuickActionMenuProps) {
  const navigate = useNavigate();

  const actions = [
    {
      icon: Users,
      label: "Create / Join Team",
      description: "Start or join a team",
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30",
      onClick: () => {
        onOpenChange(false);
        navigate("/teams");
      },
    },
    {
      icon: UserPlus,
      label: "Invite a Friend",
      description: "Share your journey",
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/30",
      onClick: () => {
        onOpenChange(false);
        navigate("/friends");
      },
    },
    {
      icon: PenLine,
      label: "Write Reflection",
      description: "Reflect on your progress",
      color: "text-violet-500",
      bgColor: "bg-violet-500/10 hover:bg-violet-500/20 border-violet-500/30",
      onClick: () => {
        onOpenChange(false);
        navigate("/");
      },
    },
    {
      icon: Target,
      label: "Create Personal Goal",
      description: "Set a new goal for yourself",
      color: "text-rose-500",
      bgColor: "bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30",
      onClick: () => {
        onOpenChange(false);
        navigate("/personalization");
      },
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-emerald-500/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <Sparkles className="w-5 h-5 text-emerald-500" />
            </div>
            <span className="bg-gradient-to-r from-emerald-500 to-cyan-500 bg-clip-text text-transparent">
              Create
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-4">
          {actions.map((action, index) => (
            <Button
              key={index}
              onClick={action.onClick}
              variant="outline"
              className={`h-auto p-4 flex items-start justify-start gap-4 transition-all ${action.bgColor}`}
            >
              <div className={`p-2 rounded-lg bg-background/50`}>
                <action.icon className={`w-5 h-5 ${action.color}`} />
              </div>
              <div className="flex flex-col items-start text-left">
                <span className="font-semibold">{action.label}</span>
                <span className="text-xs text-muted-foreground">
                  {action.description}
                </span>
              </div>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
