import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, CreditCard, Calendar, Package, Zap, Crown, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  payment_method: string;
  item_type: string;
  item_name: string;
  transaction_date: string;
  status: string;
  receipt_data: any;
}

const PaymentHistoryPage = () => {
  const queryClient = useQueryClient();

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["payment-transactions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("payment_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("transaction_date", { ascending: false });

      if (error) throw error;
      return data as Transaction[];
    },
  });

  // Separate power-up transactions from other transactions
  const { powerUpTransactions, otherTransactions, powerUpStats } = useMemo(() => {
    if (!transactions) return { powerUpTransactions: [], otherTransactions: [], powerUpStats: null };

    const powerUps = transactions.filter(
      (t) => t.item_type === "Power-Up" || t.item_type === "Extra Power-Ups"
    );
    const others = transactions.filter(
      (t) => t.item_type !== "Power-Up" && t.item_type !== "Extra Power-Ups"
    );

    // Calculate power-up stats
    const completedPowerUps = powerUps.filter(
      (t) => t.status === "completed" || t.status === "approved"
    );
    const totalSpent = completedPowerUps.reduce((sum, t) => sum + t.amount, 0);
    const totalPurchases = completedPowerUps.length;

    return {
      powerUpTransactions: powerUps,
      otherTransactions: others,
      powerUpStats: {
        totalSpent,
        totalPurchases,
        pendingCount: powerUps.filter((t) => t.status === "pending" || t.status === "pending_review").length,
      },
    };
  }, [transactions]);

  // Real-time subscription for payment status updates
  useEffect(() => {
    const setupRealtimeSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel('payment-status-updates')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'payment_transactions',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('Payment status updated:', payload);
            
            // Show toast notification based on new status
            const newStatus = payload.new.status;
            if (newStatus === 'completed' || newStatus === 'approved') {
              toast.success('Payment approved! Premium features activated.');
            } else if (newStatus === 'rejected' || newStatus === 'failed') {
              toast.error('Payment was rejected. Please contact support.');
            }
            
            // Refresh the transactions list
            queryClient.invalidateQueries({ queryKey: ["payment-transactions"] });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    setupRealtimeSubscription();
  }, [queryClient]);

  const downloadReceipt = (transaction: Transaction) => {
    const receiptContent = `
SCROLLKURAI - PAYMENT RECEIPT
==============================

Receipt ID: ${transaction.id}
Date: ${format(new Date(transaction.transaction_date), "PPP p")}

Item: ${transaction.item_name}
Type: ${transaction.item_type}
Amount: ₹${transaction.amount}
Payment Method: ${transaction.payment_method}
Status: ${transaction.status.toUpperCase()}

==============================
Thank you for your purchase!
    `.trim();

    const blob = new Blob([receiptContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${transaction.id.slice(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success("Receipt downloaded successfully");
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const renderTransactionCard = (transaction: Transaction) => (
    <Card key={transaction.id}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">{transaction.item_name}</CardTitle>
              {(transaction.item_type === "Power-Up" || transaction.item_type === "Extra Power-Ups") && (
                <Zap className="h-4 w-4 text-gold" />
              )}
            </div>
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {format(new Date(transaction.transaction_date), "PPP p")}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(transaction.amount, transaction.currency)}
            </div>
            <div className={`text-xs font-medium px-2 py-1 rounded-full inline-block ${
              transaction.status === "completed" || transaction.status === "approved"
                ? "bg-green-500/20 text-green-600" 
                : transaction.status === "rejected" || transaction.status === "failed"
                ? "bg-red-500/20 text-red-600"
                : "bg-yellow-500/20 text-yellow-600"
            }`}>
              {transaction.status === "completed" || transaction.status === "approved" 
                ? "✓ APPROVED" 
                : transaction.status === "rejected" || transaction.status === "failed"
                ? "✗ REJECTED"
                : "⏳ PENDING"}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>{transaction.item_type}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CreditCard className="h-4 w-4" />
              <span>{transaction.payment_method}</span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadReceipt(transaction)}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download Receipt
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 pb-24">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Payment History</h1>
          <p className="text-muted-foreground">
            View all your transactions and download receipts
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-20 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : transactions && transactions.length > 0 ? (
          <Tabs defaultValue="powerups" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="powerups" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Power-Ups
                {powerUpTransactions.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {powerUpTransactions.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="all" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                All Transactions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="powerups" className="space-y-6">
              {/* Power-Up Stats */}
              {powerUpStats && powerUpStats.totalPurchases > 0 && (
                <div className="grid grid-cols-3 gap-4">
                  <Card className="p-4 bg-gradient-to-br from-gold/10 to-amber-500/10 border-gold/30">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-gold/20">
                        <TrendingUp className="h-5 w-5 text-gold" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total Spent</p>
                        <p className="text-lg font-bold text-gold">₹{powerUpStats.totalSpent}</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-primary/20">
                        <Zap className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Purchases</p>
                        <p className="text-lg font-bold">{powerUpStats.totalPurchases}</p>
                      </div>
                    </div>
                  </Card>
                  {powerUpStats.pendingCount > 0 && (
                    <Card className="p-4 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/30">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-yellow-500/20">
                          <Crown className="h-5 w-5 text-yellow-500" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Pending</p>
                          <p className="text-lg font-bold text-yellow-500">{powerUpStats.pendingCount}</p>
                        </div>
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* Power-Up Transactions */}
              {powerUpTransactions.length > 0 ? (
                <div className="space-y-4">
                  {powerUpTransactions.map(renderTransactionCard)}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Zap className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No power-up purchases yet</h3>
                    <p className="text-muted-foreground text-center">
                      Your power-up purchase history will appear here
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="all" className="space-y-4">
              {transactions.map(renderTransactionCard)}
            </TabsContent>
          </Tabs>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CreditCard className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No transactions yet</h3>
              <p className="text-muted-foreground text-center">
                Your payment history will appear here once you make a purchase
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PaymentHistoryPage;