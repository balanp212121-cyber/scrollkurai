import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { TeamInviteDetailModal } from "./TeamInviteDetailModal";

interface Invite {
  id: string;
  team_id: string;
  inviter_id: string;
  status: string;
  created_at: string;
  teams: {
    name: string;
  } | null;
  inviter_profile: {
    username: string;
    level: number;
    xp: number;
  } | null;
}

export function TeamInvitesList() {
  const queryClient = useQueryClient();
  const [processingInviteId, setProcessingInviteId] = useState<string | null>(null);
  const [selectedInvite, setSelectedInvite] = useState<Invite | null>(null);

  const { data: invites, isLoading } = useQuery({
    queryKey: ["team-invites"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('team_invites')
        .select(`
          *,
          teams(name)
        `)
        .eq('invitee_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch inviter profiles separately
      if (data && data.length > 0) {
        const inviterIds = data.map(invite => invite.inviter_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, level, xp')
          .in('id', inviterIds);
        
        // Map profiles to invites
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        return data.map(invite => ({
          ...invite,
          inviter_profile: profileMap.get(invite.inviter_id) || null
        })) as Invite[];
      }
      
      return (data || []).map(invite => ({ ...invite, inviter_profile: null })) as Invite[];
    },
  });

  const handleAcceptInvite = async (inviteId: string, teamId: string) => {
    setProcessingInviteId(inviteId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check team capacity
      const { count } = await supabase
        .from('team_members')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId);

      const { data: teamData } = await supabase
        .from('teams')
        .select('max_members')
        .eq('id', teamId)
        .single();

      if (count && teamData && count >= teamData.max_members) {
        toast.error('Team is full');
        return;
      }

      // Add member
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: teamId,
          user_id: user.id,
          role: 'member'
        });

      if (memberError) throw memberError;

      // Update invite status
      const { error: inviteError } = await supabase
        .from('team_invites')
        .update({
          status: 'accepted',
          responded_at: new Date().toISOString()
        })
        .eq('id', inviteId);

      if (inviteError) throw inviteError;

      toast.success('Invite accepted! Welcome to the team!');
      queryClient.invalidateQueries({ queryKey: ["team-invites"] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      setSelectedInvite(null);
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('You are already in this team');
      } else {
        console.error('Error accepting invite:', error);
        toast.error('Failed to accept invite');
      }
    } finally {
      setProcessingInviteId(null);
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    setProcessingInviteId(inviteId);
    try {
      const { error } = await supabase
        .from('team_invites')
        .update({
          status: 'declined',
          responded_at: new Date().toISOString()
        })
        .eq('id', inviteId);

      if (error) throw error;

      toast.success('Invite declined');
      queryClient.invalidateQueries({ queryKey: ["team-invites"] });
      setSelectedInvite(null);
    } catch (error) {
      console.error('Error declining invite:', error);
      toast.error('Failed to decline invite');
    } finally {
      setProcessingInviteId(null);
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading invites...</div>;
  }

  if (!invites || invites.length === 0) {
    return null;
  }

  return (
    <Card className="p-4 bg-accent/10 border-accent/30">
      <div className="flex items-center gap-2 mb-3">
        <Mail className="w-5 h-5 text-accent" />
        <h3 className="font-semibold">Team Invites</h3>
        <Badge variant="secondary">{invites.length}</Badge>
      </div>
      
      <div className="space-y-3">
        {invites.map((invite) => (
          <div 
            key={invite.id} 
            className="flex items-center justify-between p-3 bg-background rounded-lg border hover:border-accent cursor-pointer transition-colors"
            onClick={() => setSelectedInvite(invite)}
          >
            <div className="flex-1">
              <p className="font-medium">{invite.teams?.name ?? "Team invite"}</p>
              {invite.inviter_profile && (
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm text-muted-foreground">
                    Invited by <span className="font-medium text-foreground">{invite.inviter_profile.username}</span>
                  </p>
                  <span className="text-xs text-muted-foreground">•</span>
                  <p className="text-xs text-muted-foreground">
                    Level {invite.inviter_profile.level}
                  </p>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(invite.created_at), "MMM dd, yyyy")}
              </p>
            </div>
          </div>
        ))}
      </div>

      {selectedInvite && (
        <TeamInviteDetailModal
          isOpen={!!selectedInvite}
          onClose={() => setSelectedInvite(null)}
          invite={selectedInvite}
          onAccept={handleAcceptInvite}
          onDecline={handleDeclineInvite}
          isProcessing={processingInviteId === selectedInvite.id}
        />
      )}
    </Card>
  );
}