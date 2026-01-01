import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Users } from "lucide-react";

interface Team {
  id: string;
  name: string;
}

interface TeamSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: Team[];
  onTeamSelected: (team: Team) => void;
  challengeTitle?: string;
}

export function TeamSelectionDialog({
  open,
  onOpenChange,
  teams,
  onTeamSelected,
  challengeTitle,
}: TeamSelectionDialogProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string>(teams[0]?.id || "");

  const handleConfirm = () => {
    const team = teams.find((t) => t.id === selectedTeamId);
    if (team) {
      onTeamSelected(team);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Select Team
          </DialogTitle>
          <DialogDescription>
            {challengeTitle
              ? `Choose which team to join "${challengeTitle}" with.`
              : "Choose which team to join this challenge with."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <RadioGroup
            value={selectedTeamId}
            onValueChange={setSelectedTeamId}
            className="space-y-3"
          >
            {teams.map((team) => (
              <div
                key={team.id}
                className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
                onClick={() => setSelectedTeamId(team.id)}
              >
                <RadioGroupItem value={team.id} id={team.id} />
                <Label
                  htmlFor={team.id}
                  className="flex-1 cursor-pointer font-medium"
                >
                  {team.name}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedTeamId}>
            Join with Team
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
