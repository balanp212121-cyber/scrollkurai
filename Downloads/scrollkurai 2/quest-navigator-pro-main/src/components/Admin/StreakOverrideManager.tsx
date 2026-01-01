import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Shield, Search, History, RefreshCw, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface UserProfile {
  id: string;
  username: string | null;
  streak: number;
  streak_lost_at: string | null;
  last_streak_count: number | null;
}

interface AuditLogEntry {
  id: string;
  admin_id: string;
  user_id: string;
  previous_streak: number;
  restored_streak: number;
  reason: string;
  created_at: string;
}

export function StreakOverrideManager() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [restoreCount, setRestoreCount] = useState<number>(0);
  const [reason, setReason] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["admin-user-search-streak", searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];
      
      const { data, error } = await supabase.rpc('search_users_by_username', {
        search_term: searchTerm
      });
      
      if (error) throw error;
      
      // Get full profile data for these users using admin RPC
      if (data && data.length > 0) {
        const userIds = data.map((u: any) => u.id);
        
        // Use admin function to get profiles (bypasses RLS)
        const { data: profiles, error: profilesError } = await supabase.rpc('get_profiles_by_ids_admin', {
          user_ids: userIds
        });
        
        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
          // Fallback: just use the search results
          return data.map((u: any) => ({
            id: u.id,
            username: u.username,
            streak: 0,
            streak_lost_at: null,
            last_streak_count: null,
          })) as UserProfile[];
        }
        
        // Merge basic profile data - need to get streak info separately via admin function
        const { data: streakData, error: streakError } = await supabase.functions.invoke('admin-get-user-streak', {
          body: { user_ids: userIds }
        });
        
        if (streakError || !streakData) {
          console.log('Using basic profile data without streak info');
          return profiles?.map((p: any) => ({
            id: p.id,
            username: p.username,
            streak: p.streak || 0,
            streak_lost_at: null,
            last_streak_count: null,
          })) as UserProfile[];
        }
        
        return streakData.profiles as UserProfile[];
      }
      
      return [];
    },
    enabled: searchTerm.length >= 2,
  });

  const { data: auditLogs, isLoading: logsLoading } = useQuery({
    queryKey: ["streak-override-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('streak_override_audit')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Get usernames for admin and target users
      const userIds = [...new Set([
        ...data.map(log => log.admin_id),
        ...data.map(log => log.user_id)
      ])];

      const { data: profiles } = await supabase.rpc('get_profiles_by_ids_admin', {
        user_ids: userIds
      });

      const usernameMap = new Map(profiles?.map((p: any) => [p.id, p.username]) || []);

      return data.map(log => ({
        ...log,
        admin_username: usernameMap.get(log.admin_id) || 'Unknown',
        target_username: usernameMap.get(log.user_id) || 'Unknown',
      }));
    },
  });

  const handleSelectUser = (user: UserProfile) => {
    setSelectedUser(user);
    setRestoreCount(user.last_streak_count || user.streak || 1);
    setReason("");
    setDialogOpen(true);
  };

  const handleRestoreStreak = async () => {
    if (!selectedUser || restoreCount < 1) return;

    setIsRestoring(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        toast.error("Please log in to perform admin actions");
        return;
      }

      const { data, error } = await supabase.functions.invoke('admin-restore-streak', {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
        body: {
          target_user_id: selectedUser.id,
          restore_streak_count: restoreCount,
          reason: reason || 'manual override',
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Streak Restored", {
          description: `${selectedUser.username}'s streak restored to ${restoreCount} days`
        });
        setDialogOpen(false);
        setSelectedUser(null);
        queryClient.invalidateQueries({ queryKey: ["streak-override-audit"] });
        queryClient.invalidateQueries({ queryKey: ["admin-user-search-streak"] });
      } else {
        toast.error(data.error || "Failed to restore streak");
      }
    } catch (error) {
      console.error('Error restoring streak:', error);
      toast.error("Failed to restore streak");
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Override Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Streak Override (Admin)
          </CardTitle>
          <CardDescription>
            Search for users and manually restore their streaks. This bypasses the 24-hour recovery window.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {isSearching && (
            <p className="text-sm text-muted-foreground">Searching...</p>
          )}

          {searchResults && searchResults.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Current Streak</TableHead>
                    <TableHead>Lost Streak</TableHead>
                    <TableHead>Recovery Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchResults.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.username || 'No username'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">🔥 {user.streak} days</Badge>
                      </TableCell>
                      <TableCell>
                        {user.last_streak_count ? (
                          <Badge variant="secondary">
                            {user.last_streak_count} days
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.streak_lost_at ? (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Lost {format(new Date(user.streak_lost_at), "MMM d, HH:mm")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-500 border-green-500/50">
                            Active
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSelectUser(user)}
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Override
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {searchTerm.length >= 2 && searchResults?.length === 0 && !isSearching && (
            <p className="text-sm text-muted-foreground">No users found</p>
          )}
        </CardContent>
      </Card>

      {/* Restore Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Streak (Override)</DialogTitle>
            <DialogDescription>
              Manually restore {selectedUser?.username}'s streak. This action bypasses the 24-hour recovery window.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>User</Label>
              <p className="text-sm font-medium">{selectedUser?.username}</p>
              <p className="text-xs text-muted-foreground">
                Current streak: {selectedUser?.streak} days
                {selectedUser?.last_streak_count && (
                  <> | Lost streak: {selectedUser?.last_streak_count} days</>
                )}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="restoreCount">Restore Streak To</Label>
              <Input
                id="restoreCount"
                type="number"
                min="1"
                value={restoreCount}
                onChange={(e) => setRestoreCount(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                placeholder="e.g., Technical issue, User request, etc."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRestoreStreak} disabled={isRestoring}>
              {isRestoring ? "Restoring..." : "Restore Streak"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit Log Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Streak Override History
          </CardTitle>
          <CardDescription>
            Recent admin streak restorations (last 50)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : auditLogs && auditLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Previous</TableHead>
                    <TableHead>Restored</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs font-mono">
                        {format(new Date(log.created_at), "MMM d, HH:mm")}
                      </TableCell>
                      <TableCell>{log.admin_username}</TableCell>
                      <TableCell>{log.target_username}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.previous_streak}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">{log.restored_streak}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {log.reason}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No streak overrides recorded yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
