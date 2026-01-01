import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Users, Check, X, Crown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TeamInviteDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  invite: {
    id: string;
    team_id: string;
    inviter_id: string;
    teams: { name: string } | null;
    inviter_profile: {
      username: string;
      level: number;
      xp: number;
    } | null;
  };
  onAccept: (inviteId: string, teamId: string) => void;
  onDecline: (inviteId: string) => void;
  isProcessing: boolean;
}

export function TeamInviteDetailModal({
  isOpen,
  onClose,
  invite,
  onAccept,
  onDecline,
  isProcessing
}: TeamInviteDetailModalProps) {
  const { data: teamDetails } = useQuery({
    queryKey: ["team-details", invite.team_id],
    queryFn: async () => {
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('name, description, max_members, creator_id')
        .eq('id', invite.team_id)
        .single();

      if (teamError) throw teamError;

      const { count: memberCount } = await supabase
        .from('team_members')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', invite.team_id);

      const { data: members } = await supabase
        .from('team_members')
        .select('user_id, role, profiles(username, level, xp)')
        .eq('team_id', invite.team_id);

      return {
        ...teamData,
        member_count: memberCount || 0,
        members: members || []
      };
    },
    enabled: isOpen
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Team Invite</DialogTitle>
          <DialogDescription>
            You've been invited to join a team
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Team Info */}
          <div className="p-4 bg-accent/10 rounded-lg">
            <h3 className="font-bold text-lg mb-1">{invite.teams?.name ?? "Team invite"}</h3>
            {teamDetails?.description && (
              <p className="text-sm text-muted-foreground">{teamDetails.description}</p>
            )}
          </div>

          {/* Inviter Info */}
          {invite.inviter_profile && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Invited by</h4>
              <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
                <Avatar>
                  <AvatarFallback>
                    {invite.inviter_profile.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{invite.inviter_profile.username}</p>
                  <p className="text-sm text-muted-foreground">
                    Level {invite.inviter_profile.level} • {invite.inviter_profile.xp} XP
                  </p>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Team Members */}
          {teamDetails && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Team Members
                </h4>
                <Badge variant="secondary">
                  {teamDetails.member_count}/{teamDetails.max_members}
                </Badge>
              </div>

              {teamDetails.member_count >= teamDetails.max_members && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg mb-3">
                  This team is currently full
                </div>
              )}

              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {teamDetails.members.map((member: any) => (
                  <div key={member.user_id} className="flex items-center gap-3 p-2 bg-background rounded border">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs">
                        {member.profiles?.username?.slice(0, 2).toUpperCase() || '??'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {member.profiles?.username || 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Level {member.profiles?.level || 0}
                      </p>
                    </div>
                    {member.user_id === teamDetails.creator_id && (
                      <Crown className="w-4 h-4 text-yellow-500" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => onAccept(invite.id, invite.team_id)}
              disabled={isProcessing || (teamDetails && teamDetails.member_count >= teamDetails.max_members)}
              className="flex-1 gap-2"
            >
              <Check className="w-4 h-4" />
              {isProcessing ? 'Accepting...' : 'Accept'}
            </Button>
            <Button
              onClick={() => onDecline(invite.id)}
              disabled={isProcessing}
              variant="outline"
              className="flex-1 gap-2"
            >
              <X className="w-4 h-4" />
              {isProcessing ? 'Declining...' : 'Decline'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
