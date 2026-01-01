import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addDays } from "date-fns";
import { Gift } from "lucide-react";

interface Challenge {
  id: string;
  title: string;
  description: string;
  challenge_type: "solo" | "duo" | "team";
  target_type: string;
  target_value: number;
  duration_days: number;
  starts_at: string;
  ends_at: string;
  is_public: boolean;
  reward_xp?: number;
  reward_badge_id?: string | null;
}

interface BadgeOption {
  id: string;
  name: string;
  icon: string;
}

interface EditChallengeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challenge: Challenge | null;
  onChallengeUpdated: () => void;
}

export function EditChallengeDialog({ open, onOpenChange, challenge, onChallengeUpdated }: EditChallengeDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [challengeType, setChallengeType] = useState<"solo" | "duo" | "team">("solo");
  const [targetType, setTargetType] = useState("quests");
  const [targetValue, setTargetValue] = useState("");
  const [duration, setDuration] = useState("7");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rewardXp, setRewardXp] = useState("");
  const [rewardBadgeId, setRewardBadgeId] = useState<string>("");
  const [badges, setBadges] = useState<BadgeOption[]>([]);

  useEffect(() => {
    const fetchBadges = async () => {
      const { data } = await supabase
        .from('badges')
        .select('id, name, icon')
        .order('name');
      if (data) setBadges(data);
    };
    if (open) fetchBadges();
  }, [open]);

  useEffect(() => {
    if (challenge) {
      setTitle(challenge.title);
      setDescription(challenge.description);
      setChallengeType(challenge.challenge_type);
      setTargetType(challenge.target_type);
      setTargetValue(challenge.target_value.toString());
      setDuration(challenge.duration_days.toString());
      setIsPublic(challenge.is_public);
      setRewardXp(challenge.reward_xp?.toString() || "");
      setRewardBadgeId(challenge.reward_badge_id || "none");
    }
  }, [challenge]);

  const handleSave = async () => {
    if (!challenge) return;
    
    if (!title || !description || !targetValue || !duration) {
      toast.error("Please fill all fields");
      return;
    }

    setSaving(true);
    try {
      const durationDays = parseInt(duration);
      const startDate = new Date(challenge.starts_at);
      const endDate = addDays(startDate, durationDays);

      const { error } = await supabase
        .from('challenges')
        .update({
          title,
          description,
          challenge_type: challengeType,
          target_type: targetType,
          target_value: parseInt(targetValue),
          duration_days: durationDays,
          ends_at: endDate.toISOString(),
          is_public: isPublic,
          reward_xp: rewardXp ? parseInt(rewardXp) : 0,
          reward_badge_id: rewardBadgeId && rewardBadgeId !== "none" ? rewardBadgeId : null,
        })
        .eq('id', challenge.id);

      if (error) throw error;

      toast.success("Challenge updated successfully!");
      onChallengeUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating challenge:', error);
      toast.error("Failed to update challenge");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Challenge</DialogTitle>
          <DialogDescription>
            Update the challenge details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="challengeType">Challenge Type</Label>
            <Select value={challengeType} onValueChange={(v: "solo" | "duo" | "team") => setChallengeType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solo">Solo (Individual)</SelectItem>
                <SelectItem value="duo">Duo (2 Friends)</SelectItem>
                <SelectItem value="team">Team (3-5 Members)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Challenge Title</Label>
            <Input
              id="title"
              placeholder="e.g., 30-Day Quest Streak"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the challenge..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetType">Target Type</Label>
            <Select value={targetType} onValueChange={setTargetType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quests">Quests Completed</SelectItem>
                <SelectItem value="xp">XP Earned</SelectItem>
                <SelectItem value="streak">Streak Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="targetValue">Target Value</Label>
              <Input
                id="targetValue"
                type="number"
                min="1"
                placeholder="e.g., 30"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration (days)</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                placeholder="e.g., 7"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
          </div>

          {/* Rewards Section */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Gift className="w-4 h-4" />
              <span>Completion Rewards</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rewardXp">Bonus XP</Label>
                <Input
                  id="rewardXp"
                  type="number"
                  min="0"
                  placeholder="e.g., 100"
                  value={rewardXp}
                  onChange={(e) => setRewardXp(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rewardBadge">Reward Badge</Label>
                <Select value={rewardBadgeId} onValueChange={setRewardBadgeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {badges.map((badge) => (
                      <SelectItem key={badge.id} value={badge.id}>
                        <span className="flex items-center gap-2">
                          <span>{badge.icon}</span>
                          <span>{badge.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isPublic"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="w-4 h-4"
            />
            <Label htmlFor="isPublic" className="cursor-pointer">
              Make this challenge public (visible to everyone)
            </Label>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-gradient-to-r from-primary to-accent"
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
