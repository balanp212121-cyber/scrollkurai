import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

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

interface UserProfile {
  id: string;
  username: string | null;
}

export const TransactionStatusManager = () => {
  const queryClient = useQueryClient();
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");
  const [adminNote, setAdminNote] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Fetch pending transactions
  const { data: pendingTransactions, isLoading } = useQuery({
    queryKey: ["admin-pending-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_transactions")
        .select("*")
        .in("status", ["pending", "pending_review"])
        .order("transaction_date", { ascending: false });

      if (error) throw error;
      return data as Transaction[];
    },
  });

  // Fetch user profiles for display
  const { data: userProfiles } = useQuery({
    queryKey: ["admin-user-profiles", pendingTransactions?.map(t => t.user_id)],
    queryFn: async () => {
      if (!pendingTransactions || pendingTransactions.length === 0) return {};
      
      const userIds = [...new Set(pendingTransactions.map(t => t.user_id))];
      const { data, error } = await supabase.rpc('get_profiles_by_ids_admin', { user_ids: userIds });
      
      if (error) {
        console.error("Error fetching profiles:", error);
        return {};
      }
      
      return (data || []).reduce((acc: Record<string, UserProfile>, profile: any) => {
        acc[profile.id] = profile;
        return acc;
      }, {});
    },
    enabled: !!pendingTransactions && pendingTransactions.length > 0,
  });

  const handleUpdateStatus = async () => {
    if (!selectedTransaction || !newStatus) {
      toast.error("Please select a status");
      return;
    }

    setIsUpdating(true);

    try {
      // Update transaction status
      const { error: txError } = await supabase
        .from("payment_transactions")
        .update({ status: newStatus })
        .eq("id", selectedTransaction.id);

      if (txError) throw txError;

      // If approved/completed, handle premium activation for subscriptions
      if ((newStatus === "completed" || newStatus === "approved") && 
          (selectedTransaction.item_type === "Premium Subscription" || selectedTransaction.item_type === "Pro Subscription")) {
        
        // Determine subscription duration based on item name
        let durationMonths = 1;
        if (selectedTransaction.item_name.toLowerCase().includes("yearly") || 
            selectedTransaction.item_name.toLowerCase().includes("1 year") ||
            selectedTransaction.item_name.toLowerCase().includes("annual")) {
          durationMonths = 12;
        }

        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

        // Check if subscription exists first
        const { data: existingSub } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("user_id", selectedTransaction.user_id)
          .maybeSingle();

        if (existingSub) {
          // Update existing subscription
          const { error: subError } = await supabase
            .from("subscriptions")
            .update({
              tier: selectedTransaction.item_type === "Pro Subscription" ? "pro" : "premium",
              status: "active",
              started_at: new Date().toISOString(),
              expires_at: expiresAt.toISOString(),
            })
            .eq("user_id", selectedTransaction.user_id);

          if (subError) {
            console.error("Subscription update error:", subError);
            toast.error("Transaction updated but subscription update failed");
          }
        } else {
          // Insert new subscription
          const { error: subError } = await supabase
            .from("subscriptions")
            .insert({
              user_id: selectedTransaction.user_id,
              tier: selectedTransaction.item_type === "Pro Subscription" ? "pro" : "premium",
              status: "active",
              started_at: new Date().toISOString(),
              expires_at: expiresAt.toISOString(),
            });

          if (subError) {
            console.error("Subscription insert error:", subError);
            toast.error("Transaction updated but subscription creation failed");
          }
        }

        // Update premium status
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ premium_status: true })
          .eq("id", selectedTransaction.user_id);

        if (profileError) {
          console.error("Profile update error:", profileError);
        }

        // Award premium badge if not exists
        const { data: premiumBadge } = await supabase
          .from("badges")
          .select("id")
          .eq("name", "Premium Member")
          .maybeSingle();

        if (premiumBadge) {
          // Check if badge already exists
          const { data: existingBadge } = await supabase
            .from("user_badges")
            .select("id")
            .eq("user_id", selectedTransaction.user_id)
            .eq("badge_id", premiumBadge.id)
            .maybeSingle();

          if (!existingBadge) {
            const { error: badgeError } = await supabase
              .from("user_badges")
              .insert({
                user_id: selectedTransaction.user_id,
                badge_id: premiumBadge.id,
              });

            if (badgeError) {
              console.error("Badge insert error:", badgeError);
            }
          }
        }
      }

      // Log the action (we can use role_audit_log or create a transaction audit)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("role_audit_log").insert({
          admin_id: user.id,
          target_user_id: selectedTransaction.user_id,
          action: `transaction_status_${newStatus}`,
          role: "transaction",
          target_username: adminNote || `Transaction ${selectedTransaction.id}`,
        });
      }

      // Invalidate queries
      await queryClient.invalidateQueries({ queryKey: ["admin-pending-transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-stats"] });

      toast.success(`Transaction ${newStatus === "completed" ? "approved" : newStatus}`);
      setIsDialogOpen(false);
      setSelectedTransaction(null);
      setNewStatus("");
      setAdminNote("");
    } catch (error: any) {
      console.error("Error updating transaction:", error);
      toast.error(error.message || "Failed to update transaction status");
    } finally {
      setIsUpdating(false);
    }
  };

  const openStatusDialog = (transaction: Transaction, status: string) => {
    setSelectedTransaction(transaction);
    setNewStatus(status);
    setAdminNote("");
    setIsDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
      case "approved":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Completed</Badge>;
      case "pending":
      case "pending_review":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pending</Badge>;
      case "rejected":
      case "failed":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading transactions...</span>
      </div>
    );
  }

  if (!pendingTransactions || pendingTransactions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500/50" />
        <p>No pending transactions to review</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground mb-4">
        {pendingTransactions.length} transaction(s) awaiting review
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingTransactions.map((transaction) => {
              const profile = userProfiles?.[transaction.user_id];
              return (
                <TableRow key={transaction.id}>
                  <TableCell className="font-mono text-xs">
                    {format(new Date(transaction.transaction_date), "MMM dd, HH:mm")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{profile?.username || "Unknown"}</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {transaction.user_id.slice(0, 8)}...
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{transaction.item_name}</span>
                      <span className="text-xs text-muted-foreground">{transaction.item_type}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-bold">
                    ₹{transaction.amount}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {transaction.payment_method}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(transaction.status)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-500 border-green-500/30 hover:bg-green-500/10"
                        onClick={() => openStatusDialog(transaction, "completed")}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-500 border-red-500/30 hover:bg-red-500/10"
                        onClick={() => openStatusDialog(transaction, "rejected")}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {newStatus === "completed" ? "Approve Transaction" : "Reject Transaction"}
            </DialogTitle>
            <DialogDescription>
              {newStatus === "completed" 
                ? "This will mark the transaction as completed and activate any associated premium features."
                : "This will reject the transaction. The user will not receive any features."}
            </DialogDescription>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Item:</span>
                  <p className="font-medium">{selectedTransaction.item_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Amount:</span>
                  <p className="font-medium">₹{selectedTransaction.amount}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Payment Method:</span>
                  <p className="font-medium">{selectedTransaction.payment_method}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">User ID:</span>
                  <p className="font-mono text-xs">{selectedTransaction.user_id.slice(0, 16)}...</p>
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  Admin Note (optional)
                </label>
                <Textarea
                  placeholder="Add a note about this action..."
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateStatus}
              disabled={isUpdating}
              className={newStatus === "completed" 
                ? "bg-green-600 hover:bg-green-700" 
                : "bg-red-600 hover:bg-red-700"}
            >
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {newStatus === "completed" ? (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-2" />
                  )}
                  {newStatus === "completed" ? "Approve" : "Reject"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
