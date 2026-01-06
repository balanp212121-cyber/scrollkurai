import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, X, UserPlus, Users, UserCheck } from "lucide-react";

interface CreateTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Friend {
  id: string;
  username: string;
  level: number;
}

export function CreateTeamDialog({ open, onOpenChange }: CreateTeamDialogProps) {
  const [teamType, setTeamType] = useState<'team' | 'duo'>('team');
  const [teamName, setTeamName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Friend[]>([]);
  const [searching, setSearching] = useState(false);

  const searchUsers = async (term: string) => {
    // RULE 4: Start searching from first character
    if (!term.trim() || term.length < 1) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      // RULE 1: Only search among accepted friends
      const { data, error } = await supabase.rpc('search_friends_by_username', {
        search_term: term.trim()
      });

      if (error) throw error;

      // Filter out already selected friends
      const filtered = (data || []).filter(
        (user: Friend) => !selectedFriends.find(f => f.id === user.id)
      );

      setSearchResults(filtered);
    } catch (error) {
      console.error('Error searching friends:', error);
      // If the new function doesn't exist yet, fall back silently
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const addFriend = (friend: Friend) => {
    const maxFriends = teamType === 'duo' ? 1 : 4;
    if (selectedFriends.length >= maxFriends) {
      toast.error(teamType === 'duo'
        ? "A Duo can only have 1 partner"
        : "You can add up to 4 friends (5 members total including you)");
      return;
    }
    setSelectedFriends([...selectedFriends, friend]);
    setSearchResults([]);
    setSearchTerm("");
  };

  const removeFriend = (friendId: string) => {
    setSelectedFriends(selectedFriends.filter(f => f.id !== friendId));
  };

  const handleCreateTeam = async () => {
    // Client-side validation
    if (!teamName.trim()) {
      toast.error("Please enter a team name");
      return;
    }

    if (teamName.trim().length < 3) {
      toast.error("Team name must be at least 3 characters");
      return;
    }

    if (teamName.trim().length > 50) {
      toast.error("Team name must be less than 50 characters");
      return;
    }

    const minFriends = teamType === 'duo' ? 1 : 2;
    if (selectedFriends.length < minFriends) {
      toast.error(teamType === 'duo'
        ? "You need to add 1 partner to create a Duo"
        : "You need to add at least 2 friends to create a team (3-5 members total)");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to create a team");
        return;
      }

      console.log('[Team Creation] Starting team creation for user:', user.id);

      // Create team - use maybeSingle() to handle RLS edge cases
      const maxMembers = teamType === 'duo' ? 2 : 5;
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .insert({
          name: teamName.trim(),
          description: description?.trim() || null,
          creator_id: user.id,
          team_type: teamType,
          max_members: maxMembers
        })
        .select()
        .maybeSingle();

      if (teamError) {
        console.error('[Team Creation] Team insert error:', teamError);

        // Handle duplicate team name (idempotency check)
        if (teamError.code === '23505') {
          // Check if it's the user's own team
          const { data: existingTeam } = await supabase
            .from('teams')
            .select('id, name')
            .eq('name', teamName.trim())
            .eq('creator_id', user.id)
            .maybeSingle();

          if (existingTeam) {
            console.log('[Team Creation] Team already exists:', existingTeam.id);
            toast.success("Team already created!");
            setTeamName("");
            setDescription("");
            setSelectedFriends([]);
            onOpenChange(false);
            return;
          }

          toast.error("A team with this name already exists");
          return;
        }

        if (teamError.code === '42501') {
          toast.error("Permission denied. Please try logging in again.");
          return;
        }

        throw teamError;
      }

      let team = teamData;

      // If team is null (RLS prevented immediate SELECT), query it back
      if (!team) {
        console.log('[Team Creation] Team created but not returned. Querying by name...');
        const { data: queriedTeam, error: queryError } = await supabase
          .from('teams')
          .select('id, name, description, creator_id, max_members, created_at, updated_at')
          .eq('creator_id', user.id)
          .eq('name', teamName.trim())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (queryError || !queriedTeam) {
          console.error('[Team Creation] Failed to retrieve team:', queryError);
          toast.error("Team created but couldn't be retrieved. Please refresh.");
          return;
        }

        team = queriedTeam;
        console.log('[Team Creation] Team retrieved successfully:', team.id);
      }

      console.log('[Team Creation] Team ready:', team.id);

      console.log('[Team Creation] Team ready:', team.id);

      // Trigger 'trg_add_team_creator' automatically adds creator as admin.
      // We verify this by proceeding to invites.


      // Send invites to selected friends
      const invites = selectedFriends.map(friend => ({
        team_id: team.id,
        inviter_id: user.id,
        invitee_id: friend.id,
        status: 'pending'
      }));

      const { error: inviteError } = await supabase
        .from('team_invites')
        .insert(invites);

      if (inviteError) {
        console.error('[Team Creation] Invite error:', inviteError);
        toast.warning("Team created but some invites failed to send");
      } else {
        console.log('[Team Creation] Invites sent successfully');
      }

      toast.success(`Team created! ${selectedFriends.length} invite(s) sent.`);
      setTeamName("");
      setDescription("");
      setSelectedFriends([]);
      onOpenChange(false);
    } catch (error: any) {
      console.error('[Team Creation] Unexpected error:', error);
      const errorMessage = error?.message || "Unexpected error occurred";
      toast.error(`Failed to create team: ${errorMessage}. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a New {teamType === 'duo' ? 'Duo' : 'Team'}</DialogTitle>
          <DialogDescription>
            {teamType === 'duo'
              ? "Partner up with 1 friend for duo challenges"
              : "Gather 3-5 friends to compete in team challenges"}
          </DialogDescription>
        </DialogHeader>

        {/* Team Type Selection */}
        <RadioGroup
          value={teamType}
          onValueChange={(value) => {
            setTeamType(value as 'team' | 'duo');
            setSelectedFriends([]); // Reset selection on type change
          }}
          className="flex gap-4 pt-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="team" id="team" />
            <Label htmlFor="team" className="flex items-center gap-1 cursor-pointer">
              <Users className="w-4 h-4" /> Team (3-5)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="duo" id="duo" />
            <Label htmlFor="duo" className="flex items-center gap-1 cursor-pointer">
              <UserCheck className="w-4 h-4" /> Duo (2)
            </Label>
          </div>
        </RadioGroup>

        <div className="space-y-4">
          <div>
            <Label htmlFor="teamName">Team Name</Label>
            <Input
              id="teamName"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Enter team name"
              maxLength={50}
            />
          </div>

          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's your team about?"
              maxLength={200}
            />
          </div>

          <div>
            <Label>{teamType === 'duo' ? 'Add Partner (1 friend)' : 'Add Friends (2-4 friends required)'}</Label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  searchUsers(e.target.value);
                }}
                placeholder="Search by username..."
                className="pl-9"
              />
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <ScrollArea className="h-32 mt-2 border rounded-md">
                <div className="p-2 space-y-1">
                  {searchResults.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-2 hover:bg-accent rounded-md cursor-pointer"
                      onClick={() => addFriend(user)}
                    >
                      <div>
                        <p className="font-medium text-sm">{user.username}</p>
                        <p className="text-xs text-muted-foreground">Level {user.level}</p>
                      </div>
                      <Button size="sm" variant="ghost">
                        <UserPlus className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {/* Selected Friends */}
            {selectedFriends.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {selectedFriends.map((friend) => (
                  <Badge key={friend.id} className="gap-1 pr-1">
                    {friend.username}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={() => removeFriend(friend.id)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground mt-2">
              {teamType === 'duo'
                ? `Selected: ${selectedFriends.length}/1 partner • Total members: ${selectedFriends.length + 1}/2`
                : `Selected: ${selectedFriends.length}/4 friends • Total members: ${selectedFriends.length + 1}/5`}
            </p>
          </div>

          <Button
            onClick={handleCreateTeam}
            disabled={loading || !teamName.trim() || selectedFriends.length < (teamType === 'duo' ? 1 : 2)}
            className="w-full"
          >
            {loading ? "Creating..." : (teamType === 'duo' ? "Create Duo" : "Create Team")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}