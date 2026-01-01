import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addDays } from "date-fns";
import { Gift, Trophy } from "lucide-react";

interface CreateChallengeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChallengeCreated: () => void;
}

interface BadgeOption {
  id: string;
  name: string;
  icon: string;
}

export function CreateChallengeDialog({ open, onOpenChange, onChallengeCreated }: CreateChallengeDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [challengeType, setChallengeType] = useState<"solo" | "duo" | "team">("solo");
  const [targetType, setTargetType] = useState("quests");
  const [targetValue, setTargetValue] = useState("");
  const [duration, setDuration] = useState("7");
  const [isPublic, setIsPublic] = useState(true);
  const [creating, setCreating] = useState(false);
  const [duoPartner, setDuoPartner] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [rewardXp, setRewardXp] = useState("");
  const [rewardBadgeId, setRewardBadgeId] = useState<string>("none");
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

  const searchUsers = async (term: string) => {
    if (!term.trim()) return;
    setSearching(true);
    try {
      const { data } = await supabase.rpc('search_users_by_username', {
        search_term: term
      });
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleCreate = async () => {
    if (!title || !description || !targetValue || !duration) {
      toast.error("Please fill all fields");
      return;
    }

    if (challengeType === 'duo' && !duoPartner) {
      toast.error("Please select a partner for duo challenge");
      return;
    }

    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to create challenges");
        return;
      }

      const durationDays = parseInt(duration);
      const startDate = new Date();
      const endDate = addDays(startDate, durationDays);

      const { error } = await supabase
        .from('challenges')
        .insert({
          title,
          description,
          challenge_type: challengeType,
          target_type: targetType,
          target_value: parseInt(targetValue),
          duration_days: durationDays,
          starts_at: startDate.toISOString(),
          ends_at: endDate.toISOString(),
          is_public: isPublic,
          creator_id: user.id,
          reward_xp: rewardXp ? parseInt(rewardXp) : 0,
          reward_badge_id: rewardBadgeId && rewardBadgeId !== "none" ? rewardBadgeId : null,
        });

      if (error) throw error;

      // If duo challenge, auto-join creator and partner
      if (challengeType === 'duo' && duoPartner) {
        // Creator joins
        await supabase.from('challenge_participants').insert({
          challenge_id: (await supabase.from('challenges').select('id').eq('creator_id', user.id).order('created_at', { ascending: false }).limit(1).single()).data?.id,
          user_id: user.id,
          duo_partner_id: duoPartner
        });

        // Auto-join partner with reversed link
        await supabase.from('challenge_participants').insert({
          challenge_id: (await supabase.from('challenges').select('id').eq('creator_id', user.id).order('created_at', { ascending: false }).limit(1).single()).data?.id,
          user_id: duoPartner,
          duo_partner_id: user.id
        });
      }

      toast.success("Challenge created successfully! 🎉");
      
      // Reset form
      setTitle("");
      setDescription("");
      setTargetValue("");
      setDuration("7");
      setTargetType("quests");
      setDuoPartner("");
      setSearchResults([]);
      setRewardXp("");
      setRewardBadgeId("none");
      
      onChallengeCreated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating challenge:', error);
      toast.error("Failed to create challenge");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Challenge</DialogTitle>
          <DialogDescription>
            Create a challenge for yourself or the community
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

          {challengeType === 'duo' && (
            <div className="space-y-2">
              <Label htmlFor="duoPartner">Select Partner</Label>
              <div className="flex gap-2">
                <Input
                  id="duoPartner"
                  placeholder="Search by username..."
                  value={duoPartner ? searchResults.find(u => u.id === duoPartner)?.username : ''}
                  onChange={(e) => {
                    setDuoPartner('');
                    searchUsers(e.target.value);
                  }}
                />
              </div>
              {searchResults.length > 0 && !duoPartner && (
                <div className="border rounded-lg max-h-40 overflow-y-auto">
                  {searchResults.map((user) => (
                    <div
                      key={user.id}
                      onClick={() => setDuoPartner(user.id)}
                      className="p-2 hover:bg-muted cursor-pointer flex items-center justify-between"
                    >
                      <span className="text-sm">{user.username}</span>
                      <Badge variant="outline" className="text-xs">Level {user.level}</Badge>
                    </div>
                  ))}
                </div>
              )}
              {duoPartner && (
                <Badge className="bg-primary/20 text-primary">
                  Partner: {searchResults.find(u => u.id === duoPartner)?.username}
                </Badge>
              )}
            </div>
          )}

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
              onClick={handleCreate}
              disabled={creating}
              className="flex-1 bg-gradient-to-r from-primary to-accent"
            >
              {creating ? "Creating..." : "Create Challenge"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
