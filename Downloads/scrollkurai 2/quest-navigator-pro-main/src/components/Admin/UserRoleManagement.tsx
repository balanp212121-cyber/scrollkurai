import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Shield, ShieldAlert, User, UserMinus, UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { RoleAuditLog } from "./RoleAuditLog";

interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'moderator' | 'user';
  created_at: string;
  username?: string;
}

interface SearchedUser {
  id: string;
  username: string;
  level: number;
}

export function UserRoleManagement() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<SearchedUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'moderator' | 'user'>('moderator');

  // Fetch all users with roles
  const { data: userRoles, isLoading: rolesLoading } = useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get usernames for each role using admin-safe RPC
      const userIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase.rpc('get_profiles_by_ids_admin', {
        user_ids: userIds
      });

      return roles.map(role => ({
        ...role,
        username: profiles?.find(p => p.id === role.user_id)?.username || 'Unknown'
      })) as UserRole[];
    },
  });

  // Search users
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ["admin-search-users", searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];

      const { data, error } = await supabase.rpc('search_users_by_username', {
        search_term: searchTerm
      });

      if (error) throw error;
      return data as SearchedUser[];
    },
    enabled: searchTerm.length >= 2,
  });

  // Add role mutation
  const addRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { data, error } = await supabase.functions.invoke('manage-user-roles', {
        body: {
          targetUserId: userId,
          role: role,
          action: 'add'
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Role added successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
      queryClient.invalidateQueries({ queryKey: ["role-audit-log"] });
      setSelectedUser(null);
      setSearchTerm("");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add role");
    }
  });

  // Remove role mutation
  const removeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { data, error } = await supabase.functions.invoke('manage-user-roles', {
        body: {
          targetUserId: userId,
          role: role,
          action: 'remove'
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Role removed successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
      queryClient.invalidateQueries({ queryKey: ["role-audit-log"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove role");
    }
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: {
          targetUserId: userId,
          reason: 'Deleted via Admin Dashboard'
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "User deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-search-users"] });
      setSelectedUser(null);
      setSearchTerm("");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete user");
    }
  });

  const handleAddRole = () => {
    if (!selectedUser) {
      toast.error("Please select a user first");
      return;
    }
    addRoleMutation.mutate({ userId: selectedUser.id, role: selectedRole });
  };

  const handleRemoveRole = (userId: string, role: string) => {
    if (window.confirm(`Are you sure you want to remove the '${role}' role? This action will be logged.`)) {
      removeRoleMutation.mutate({ userId, role });
    }
  };

  const handleDeleteUser = () => {
    if (!selectedUser) return;

    // Double confirmation for safety
    if (window.confirm(`DANGER: Are you sure you want to PERMANENTLY DELETE user '${selectedUser.username}'?`)) {
      if (window.confirm(`This action cannot be undone. All data for '${selectedUser.username}' will be lost. Confirm deletion?`)) {
        deleteUserMutation.mutate(selectedUser.id);
      }
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <ShieldAlert className="h-4 w-4 text-red-500" />;
      case 'moderator':
        return <Shield className="h-4 w-4 text-yellow-500" />;
      default:
        return <User className="h-4 w-4 text-blue-500" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'moderator':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* Add Role Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Assign Role
          </CardTitle>
          <CardDescription>
            Search for a user and assign them a role
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by username..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setSelectedUser(null);
                }}
                className="pl-10"
              />
              {/* Search Results Dropdown */}
              {searchResults && searchResults.length > 0 && !selectedUser && (
                <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      className="w-full px-4 py-2 text-left hover:bg-accent flex items-center justify-between"
                      onClick={() => {
                        setSelectedUser(user);
                        setSearchTerm(user.username);
                      }}
                    >
                      <span>{user.username}</span>
                      <Badge variant="outline">Level {user.level}</Badge>
                    </button>
                  ))}
                </div>
              )}
              {searchLoading && searchTerm.length >= 2 && (
                <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-md shadow-lg p-4 text-center text-muted-foreground">
                  Searching...
                </div>
              )}
            </div>
            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as 'admin' | 'moderator' | 'user')}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-red-500" />
                    Admin
                  </div>
                </SelectItem>
                <SelectItem value="moderator">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-yellow-500" />
                    Moderator
                  </div>
                </SelectItem>
                <SelectItem value="user">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-500" />
                    User
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleAddRole}
              disabled={!selectedUser || addRoleMutation.isPending}
              className="gap-2"
            >
              <UserPlus className="h-4 w-4" />
              {addRoleMutation.isPending ? "Adding..." : "Add Role"}
            </Button>
          </div>
          {selectedUser && (
            <div className="p-3 bg-accent/50 rounded-lg flex items-center justify-between">
              <p className="text-sm">
                Selected: <span className="font-semibold">{selectedUser.username}</span> (Level {selectedUser.level})
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteUser}
                disabled={deleteUserMutation.isPending}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {deleteUserMutation.isPending ? "Deleting..." : "Delete User"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Roles Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Current Role Assignments
          </CardTitle>
          <CardDescription>
            {userRoles?.length || 0} role(s) assigned
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rolesLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading roles...
            </div>
          ) : userRoles && userRoles.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userRoles.map((roleAssignment) => (
                    <TableRow key={roleAssignment.id}>
                      <TableCell className="font-medium">
                        {roleAssignment.username}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(roleAssignment.role) as any} className="gap-1">
                          {getRoleIcon(roleAssignment.role)}
                          {roleAssignment.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(roleAssignment.created_at), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemoveRole(roleAssignment.user_id, roleAssignment.role)}
                          disabled={removeRoleMutation.isPending}
                        >
                          <UserMinus className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No roles assigned yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Log */}
      <RoleAuditLog />
    </div>
  );
}
