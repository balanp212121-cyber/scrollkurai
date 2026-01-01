import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, UserPlus, Loader2, Star } from "lucide-react";

interface TeamInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  teamName: string;
  currentMemberCount: number;
  maxMembers: number;
}

interface SearchUser {
  id: string;
  username: string;
  level: number;
}

export function TeamInviteDialog({ 
  open, 
  onOpenChange, 
  teamId, 
  teamName,
  currentMemberCount,
  maxMembers 
}: TeamInviteDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);
  const [existingInvites, setExistingInvites] = useState<string[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);

  // Fetch existing members and pending invites when dialog opens
  useEffect(() => {
    if (open) {
      fetchExistingData();
      setSearchTerm("");
      setSearchResults([]);
    }
  }, [open, teamId]);

  const fetchExistingData = async () => {
    try {
      // Fetch current team members
      const { data: members } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', teamId);

      setMemberIds(members?.map(m => m.user_id) || []);

      // Fetch pending invites
      const { data: invites } = await supabase
        .from('team_invites')
        .select('invitee_id')
        .eq('team_id', teamId)
        .eq('status', 'pending');

      setExistingInvites(invites?.map(i => i.invitee_id) || []);
    } catch (error) {
      console.error('Error fetching existing data:', error);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim().length >= 2) {
        handleSearch();
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSearch = async () => {
    if (!searchTerm.trim() || searchTerm.trim().length < 2) return;
    
    setSearching(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.rpc('search_users_by_username', {
        search_term: searchTerm.trim()
      });

      if (error) throw error;

      // Filter out current user, team members, and users with pending invites
      const filteredResults = (data || []).filter((u: SearchUser) => 
        u.id !== user.id && 
        !memberIds.includes(u.id) && 
        !existingInvites.includes(u.id)
      );

      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Error searching users:', error);
      toast.error('Failed to search users');
    } finally {
      setSearching(false);
    }
  };

  const handleInvite = async (userId: string, username: string) => {
    if (currentMemberCount >= maxMembers) {
      toast.error(`Team is full (${maxMembers} members max)`);
      return;
    }

    setInviting(userId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check for existing invite again (in case of race condition)
      const { data: existing } = await supabase
        .from('team_invites')
        .select('id, status')
        .eq('team_id', teamId)
        .eq('invitee_id', userId)
        .maybeSingle();

      if (existing) {
        if (existing.status === 'pending') {
          toast.error('Invite already sent to this user');
        } else if (existing.status === 'accepted') {
          toast.error('User is already a member');
        } else {
          // Update rejected/expired invite to pending
          await supabase
            .from('team_invites')
            .update({ status: 'pending', created_at: new Date().toISOString() })
            .eq('id', existing.id);
          toast.success(`Invite re-sent to ${username}!`);
        }
        setSearchResults(prev => prev.filter(u => u.id !== userId));
        setExistingInvites(prev => [...prev, userId]);
        return;
      }

      const { error } = await supabase
        .from('team_invites')
        .insert({
          team_id: teamId,
          inviter_id: user.id,
          invitee_id: userId,
          status: 'pending'
        });

      if (error) throw error;

      toast.success(`Invite sent to ${username}!`);
      setSearchResults(prev => prev.filter(u => u.id !== userId));
      setExistingInvites(prev => [...prev, userId]);
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Invite already sent');
      } else {
        console.error('Error sending invite:', error);
        toast.error('Failed to send invite');
      }
    } finally {
      setInviting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to {teamName}</DialogTitle>
          <DialogDescription>
            Search for users to invite ({currentMemberCount}/{maxMembers} members)
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by username (min 2 chars)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              autoFocus
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {searchResults.map((user) => (
                <div 
                  key={user.id} 
                  className="flex items-center justify-between p-3 border rounded-lg bg-card/50 hover:bg-card/80 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-sm">
                      {user.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="font-medium">{user.username}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Star className="w-3 h-3" />
                        Level {user.level}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleInvite(user.id, user.username)}
                    disabled={inviting === user.id || currentMemberCount >= maxMembers}
                    className="gap-1"
                  >
                    {inviting === user.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserPlus className="w-4 h-4" />
                    )}
                    {inviting === user.id ? 'Sending...' : 'Invite'}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {searchTerm.length >= 2 && searchResults.length === 0 && !searching && (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">No users found matching "{searchTerm}"</p>
              <p className="text-xs text-muted-foreground mt-1">Try a different search term</p>
            </div>
          )}

          {searchTerm.length > 0 && searchTerm.length < 2 && (
            <p className="text-sm text-center text-muted-foreground py-4">
              Type at least 2 characters to search
            </p>
          )}

          {existingInvites.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                {existingInvites.length} pending invite{existingInvites.length > 1 ? 's' : ''} sent
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}