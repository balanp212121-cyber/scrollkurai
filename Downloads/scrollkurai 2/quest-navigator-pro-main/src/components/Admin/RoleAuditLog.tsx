import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, UserPlus, UserMinus, Download } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface AuditLogEntry {
  id: string;
  admin_id: string;
  target_user_id: string;
  action: 'add' | 'remove';
  role: string;
  target_username: string | null;
  created_at: string;
  admin_username?: string;
}

export function RoleAuditLog() {
  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ["role-audit-log"],
    queryFn: async () => {
      const { data: logs, error } = await supabase
        .from("role_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Get admin usernames using admin-safe RPC
      const adminIds = [...new Set(logs.map(l => l.admin_id))];
      const { data: profiles } = await supabase.rpc('get_profiles_by_ids_admin', {
        user_ids: adminIds
      });

      return logs.map(log => ({
        ...log,
        admin_username: profiles?.find(p => p.id === log.admin_id)?.username || 'Unknown Admin'
      })) as AuditLogEntry[];
    },
  });

  const exportToCSV = () => {
    if (!auditLogs || auditLogs.length === 0) {
      toast.error("No audit logs to export");
      return;
    }

    const headers = ["Action", "Target User", "Role", "Admin", "Date"];
    const rows = auditLogs.map(log => [
      log.action === 'add' ? 'Added' : 'Removed',
      log.target_username || 'Unknown',
      log.role,
      log.admin_username || 'Unknown',
      format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss")
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `role-audit-log-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Audit log exported successfully");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Role Change History
            </CardTitle>
            <CardDescription>
              Recent role assignments and removals (last 50)
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={exportToCSV} disabled={!auditLogs || auditLogs.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading audit logs...
          </div>
        ) : auditLogs && auditLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Target User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>By Admin</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {log.action === 'add' ? (
                        <Badge variant="default" className="gap-1 bg-green-600">
                          <UserPlus className="h-3 w-3" />
                          Added
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <UserMinus className="h-3 w-3" />
                          Removed
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {log.target_username || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.role}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {log.admin_username}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(log.created_at), "MMM dd, yyyy HH:mm")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No audit logs yet
          </div>
        )}
      </CardContent>
    </Card>
  );
}