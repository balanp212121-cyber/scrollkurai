import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Search, DollarSign, TrendingUp, Users, Package, FileCheck, Shield, Flame, Trophy, Clock, RefreshCw, BarChart3, MessageCircle, History } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { Navigate } from "react-router-dom";
import { PaymentProofReview } from "@/components/Admin/PaymentProofReview";
import { UserRoleManagement } from "@/components/Admin/UserRoleManagement";
import { StreakOverrideManager } from "@/components/Admin/StreakOverrideManager";
import { ChallengeParticipantsManager } from "@/components/Admin/ChallengeParticipantsManager";
import { TransactionStatusManager } from "@/components/Admin/TransactionStatusManager";
import { PaymentAnalytics } from "@/components/Admin/PaymentAnalytics";
import { SystemHealthPanel } from "@/components/Admin/SystemHealthPanel";
import { CounsellingRequestsPanel } from "@/components/Admin/CounsellingRequestsPanel";
import { AdminAuditLogViewer } from "@/components/Admin/AdminAuditLogViewer";
import { PendingChallengesPanel } from "@/components/Admin/PendingChallengesPanel";
import { isFeatureEnabled } from "@/lib/featureFlags";

interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  item_type: string;
  item_name: string;
  transaction_date: string;
  status: string;
}

const AdminDashboard = () => {
  const { data: isAdmin, isLoading: adminLoading } = useAdminCheck();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["admin-transactions", searchTerm, filterType, filterStatus],
    queryFn: async () => {
      // Limited to 200 for performance at scale
      // TODO: Add pagination with offset when exceeding 100k users
      let query = supabase
        .from("payment_transactions")
        .select("*")
        .order("transaction_date", { ascending: false })
        .limit(200);

      if (searchTerm) {
        query = query.or(`item_name.ilike.%${searchTerm}%,user_id.ilike.%${searchTerm}%`);
      }

      if (filterType !== "all") {
        query = query.eq("item_type", filterType);
      }

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Transaction[];
    },
    enabled: isAdmin === true,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_transactions")
        .select("amount, status, user_id");

      if (error) throw error;

      // Count revenue from completed transactions (approved payments)
      const completedStatuses = ['completed', 'approved'];
      const totalRevenue = data?.reduce((sum, t) => {
        if (completedStatuses.includes(t.status)) {
          return sum + (t.amount || 0);
        }
        return sum;
      }, 0) || 0;

      const totalTransactions = data?.length || 0;
      const uniqueUsers = new Set(data?.map(t => t.user_id)).size;
      const completedTransactions = data?.filter(t => completedStatuses.includes(t.status)).length || 0;

      // Also calculate pending revenue for visibility
      const pendingRevenue = data?.reduce((sum, t) => {
        if (['pending', 'pending_review'].includes(t.status)) {
          return sum + (t.amount || 0);
        }
        return sum;
      }, 0) || 0;

      const pendingTransactions = data?.filter(t => ['pending', 'pending_review'].includes(t.status)).length || 0;

      return {
        totalRevenue,
        totalTransactions,
        uniqueUsers,
        completedTransactions,
        pendingRevenue,
        pendingTransactions,
      };
    },
    enabled: isAdmin === true,
  });

  const { data: pendingProofsCount } = useQuery({
    queryKey: ["admin-pending-proofs-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("payment_proofs")
        .select("*", { count: 'exact', head: true })
        .eq("status", "pending");

      if (error) throw error;
      return count || 0;
    },
    enabled: isAdmin === true,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const exportToCSV = () => {
    if (!transactions || transactions.length === 0) {
      toast.error("No transactions to export");
      return;
    }

    const headers = ["Date", "Transaction ID", "User ID", "Item", "Type", "Amount", "Method", "Status"];
    const csvData = transactions.map(t => [
      format(new Date(t.transaction_date), "yyyy-MM-dd HH:mm:ss"),
      t.id,
      t.user_id,
      t.item_name,
      t.item_type,
      `${t.amount} ${t.currency}`,
      t.payment_method,
      t.status,
    ]);

    const csvContent = [
      headers.join(","),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("CSV exported successfully");
  };

  if (adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-primary text-xl">Checking permissions...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Manage and monitor all payment transactions
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <Card className="border-green-500/30 bg-green-500/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Confirmed Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">₹{stats?.totalRevenue || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.completedTransactions || 0} completed
              </p>
            </CardContent>
          </Card>

          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Revenue</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">₹{stats?.pendingRevenue || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.pendingTransactions || 0} awaiting review
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalTransactions || 0}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Paying Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.uniqueUsers || 0}</div>
              <p className="text-xs text-muted-foreground">Unique customers</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Transaction</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₹{stats?.completedTransactions
                  ? Math.round(stats.totalRevenue / stats.completedTransactions)
                  : 0}
              </div>
              <p className="text-xs text-muted-foreground">Per completed</p>
            </CardContent>
          </Card>

          {isFeatureEnabled("enable_manual_payment_review") && (
            <Card className="border-yellow-500/30 bg-yellow-500/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pending Proofs</CardTitle>
                <FileCheck className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-500">
                  {pendingProofsCount || 0}
                </div>
                <p className="text-xs text-muted-foreground">Awaiting review</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Tabs for Transactions and Payment Proofs */}
        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList className="flex flex-wrap gap-1 h-auto p-1 w-full">
            <TabsTrigger value="analytics" className="flex-1 min-w-[70px] text-xs sm:text-sm">
              <BarChart3 className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="transactions" className="flex-1 min-w-[70px] text-xs sm:text-sm">
              <DollarSign className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Transactions</span>
            </TabsTrigger>
            <TabsTrigger value="pending-actions" className="flex-1 min-w-[70px] text-xs sm:text-sm">
              <RefreshCw className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Pending</span>
            </TabsTrigger>
            {isFeatureEnabled("enable_manual_payment_review") && (
              <TabsTrigger value="payment-proofs" className="flex-1 min-w-[70px] text-xs sm:text-sm">
                <FileCheck className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Proofs</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="challenges" className="flex-1 min-w-[70px] text-xs sm:text-sm">
              <Trophy className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Challenges</span>
            </TabsTrigger>
            <TabsTrigger value="user-roles" className="flex-1 min-w-[70px] text-xs sm:text-sm">
              <Shield className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Roles</span>
            </TabsTrigger>
            <TabsTrigger value="streak-override" className="flex-1 min-w-[70px] text-xs sm:text-sm">
              <Flame className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Streaks</span>
            </TabsTrigger>
            <TabsTrigger value="counselling" className="flex-1 min-w-[70px] text-xs sm:text-sm">
              <MessageCircle className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Counselling</span>
            </TabsTrigger>
            <TabsTrigger value="system-health" className="flex-1 min-w-[70px] text-xs sm:text-sm">
              <BarChart3 className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Health</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="space-y-6">
            <PaymentAnalytics />
          </TabsContent>

          <TabsContent value="transactions" className="space-y-6">
            {/* Filters and Search */}
            <Card>
              <CardHeader>
                <CardTitle>Transaction Filters</CardTitle>
                <CardDescription>Filter and search through all transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by item name or user ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-full md:w-48">
                      <SelectValue placeholder="Item Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="Power-Up">Power-Ups</SelectItem>
                      <SelectItem value="Premium Subscription">Premium</SelectItem>
                      <SelectItem value="Pro Subscription">Pro</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-full md:w-48">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="pending_review">Pending Review</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={exportToCSV} variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Transactions Table */}
            <Card>
              <CardHeader>
                <CardTitle>All Transactions</CardTitle>
                <CardDescription>
                  {transactions?.length || 0} transaction(s) found
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading transactions...
                  </div>
                ) : transactions && transactions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>User ID</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((transaction) => (
                          <TableRow key={transaction.id}>
                            <TableCell className="font-mono text-xs">
                              {format(new Date(transaction.transaction_date), "MMM dd, HH:mm")}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {transaction.user_id.slice(0, 8)}...
                            </TableCell>
                            <TableCell className="font-medium">
                              {transaction.item_name}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{transaction.item_type}</Badge>
                            </TableCell>
                            <TableCell className="font-bold">
                              ₹{transaction.amount}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {transaction.payment_method}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  transaction.status === "completed"
                                    ? "default"
                                    : transaction.status === "pending" || transaction.status === "pending_review"
                                      ? "secondary"
                                      : "destructive"
                                }
                              >
                                {transaction.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No transactions found
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pending-actions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Pending Transaction Actions</CardTitle>
                <CardDescription>
                  Approve or reject pending transactions manually
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TransactionStatusManager />
              </CardContent>
            </Card>
          </TabsContent>

          {isFeatureEnabled("enable_manual_payment_review") && (
            <TabsContent value="payment-proofs" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Payment Proof Review</CardTitle>
                  <CardDescription>
                    Review and approve payment proofs from users
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PaymentProofReview />
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="challenges" className="space-y-6">
            <PendingChallengesPanel />
            <ChallengeParticipantsManager />
          </TabsContent>

          <TabsContent value="user-roles" className="space-y-6">
            <UserRoleManagement />
          </TabsContent>

          <TabsContent value="streak-override" className="space-y-6">
            <StreakOverrideManager />
          </TabsContent>

          <TabsContent value="counselling" className="space-y-6">
            <CounsellingRequestsPanel />
          </TabsContent>

          <TabsContent value="system-health" className="space-y-6">
            <SystemHealthPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;