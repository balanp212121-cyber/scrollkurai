import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, Area, AreaChart
} from "recharts";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";
import { TrendingUp, TrendingDown, DollarSign, CheckCircle, XCircle, Clock, Percent } from "lucide-react";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export const PaymentAnalytics = () => {
  // Fetch all transactions for analytics
  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ["payment-analytics-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_transactions")
        .select("*")
        .order("transaction_date", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Fetch payment proofs for approval analytics
  const { data: paymentProofs, isLoading: proofsLoading } = useQuery({
    queryKey: ["payment-analytics-proofs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_proofs")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const isLoading = transactionsLoading || proofsLoading;

  // Calculate analytics
  const analytics = (() => {
    if (!transactions) return null;

    const totalTransactions = transactions.length;
    const completedStatuses = ['completed', 'approved'];
    const completedTransactions = transactions.filter(t => completedStatuses.includes(t.status));
    const pendingTransactions = transactions.filter(t => ['pending', 'pending_review'].includes(t.status));
    const rejectedTransactions = transactions.filter(t => ['rejected', 'failed'].includes(t.status));

    const totalRevenue = completedTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const pendingRevenue = pendingTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

    // Approval rate
    const reviewedTransactions = completedTransactions.length + rejectedTransactions.length;
    const approvalRate = reviewedTransactions > 0
      ? Math.round((completedTransactions.length / reviewedTransactions) * 100)
      : 0;

    // Daily volume for last 30 days
    const last30Days = eachDayOfInterval({
      start: subDays(new Date(), 29),
      end: new Date()
    });

    const dailyVolume = last30Days.map(day => {
      const dayStart = startOfDay(day);
      const dayTransactions = transactions.filter(t => {
        const tDate = startOfDay(new Date(t.transaction_date));
        return tDate.getTime() === dayStart.getTime();
      });

      const completed = dayTransactions.filter(t => completedStatuses.includes(t.status));
      const pending = dayTransactions.filter(t => ['pending', 'pending_review'].includes(t.status));
      const failed = dayTransactions.filter(t => ['rejected', 'failed'].includes(t.status));

      return {
        date: format(day, 'MMM dd'),
        fullDate: format(day, 'yyyy-MM-dd'),
        total: dayTransactions.length,
        completed: completed.length,
        pending: pending.length,
        failed: failed.length,
        revenue: completed.reduce((sum, t) => sum + (t.amount || 0), 0),
      };
    });

    // Revenue by item type
    const revenueByType = transactions.reduce((acc: Record<string, number>, t) => {
      if (completedStatuses.includes(t.status)) {
        acc[t.item_type] = (acc[t.item_type] || 0) + (t.amount || 0);
      }
      return acc;
    }, {});

    const revenueByTypeData = Object.entries(revenueByType).map(([name, value]) => ({
      name,
      value,
    }));

    // Transaction status distribution
    const statusDistribution = [
      { name: 'Completed', value: completedTransactions.length, color: 'hsl(var(--chart-2))' },
      { name: 'Pending', value: pendingTransactions.length, color: 'hsl(var(--chart-4))' },
      { name: 'Failed/Rejected', value: rejectedTransactions.length, color: 'hsl(var(--destructive))' },
    ].filter(s => s.value > 0);

    // Payment method distribution
    const paymentMethods = transactions.reduce((acc: Record<string, number>, t) => {
      acc[t.payment_method] = (acc[t.payment_method] || 0) + 1;
      return acc;
    }, {});

    const paymentMethodData = Object.entries(paymentMethods).map(([name, value]) => ({
      name,
      value,
    }));

    // Weekly trends (last 8 weeks)
    const weeklyRevenue: { week: string; revenue: number; transactions: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = subDays(new Date(), i * 7 + 6);
      const weekEnd = subDays(new Date(), i * 7);

      const weekTransactions = transactions.filter(t => {
        const tDate = new Date(t.transaction_date);
        return tDate >= weekStart && tDate <= weekEnd && completedStatuses.includes(t.status);
      });

      weeklyRevenue.push({
        week: `Week ${8 - i}`,
        revenue: weekTransactions.reduce((sum, t) => sum + (t.amount || 0), 0),
        transactions: weekTransactions.length,
      });
    }

    // Average transaction value
    const avgTransactionValue = completedTransactions.length > 0
      ? Math.round(totalRevenue / completedTransactions.length)
      : 0;

    // Compare to previous period
    const midPoint = Math.floor(transactions.length / 2);
    const recentHalf = transactions.slice(midPoint);
    const olderHalf = transactions.slice(0, midPoint);

    const recentRevenue = recentHalf
      .filter(t => completedStatuses.includes(t.status))
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const olderRevenue = olderHalf
      .filter(t => completedStatuses.includes(t.status))
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const revenueGrowth = olderRevenue > 0
      ? Math.round(((recentRevenue - olderRevenue) / olderRevenue) * 100)
      : 0;

    return {
      totalTransactions,
      completedCount: completedTransactions.length,
      pendingCount: pendingTransactions.length,
      rejectedCount: rejectedTransactions.length,
      totalRevenue,
      pendingRevenue,
      approvalRate,
      avgTransactionValue,
      revenueGrowth,
      dailyVolume,
      revenueByTypeData,
      statusDistribution,
      paymentMethodData,
      weeklyRevenue,
    };
  })();

  // Proof analytics
  const proofAnalytics = (() => {
    if (!paymentProofs) return null;

    const total = paymentProofs.length;
    const approved = paymentProofs.filter(p => p.status === 'approved').length;
    const rejected = paymentProofs.filter(p => p.status === 'rejected').length;
    const pending = paymentProofs.filter(p => p.status === 'pending').length;

    const approvalRate = (approved + rejected) > 0
      ? Math.round((approved / (approved + rejected)) * 100)
      : 0;

    // Average review time (for reviewed proofs)
    const reviewedProofs = paymentProofs.filter(p => p.reviewed_at);
    const avgReviewTime = reviewedProofs.length > 0
      ? reviewedProofs.reduce((sum, p) => {
        const created = new Date(p.created_at).getTime();
        const reviewed = new Date(p.reviewed_at!).getTime();
        return sum + (reviewed - created);
      }, 0) / reviewedProofs.length / (1000 * 60 * 60) // Convert to hours
      : 0;

    return {
      total,
      approved,
      rejected,
      pending,
      approvalRate,
      avgReviewTime: Math.round(avgReviewTime * 10) / 10,
    };
  })();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No transaction data available for analytics.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-1 p-2 sm:p-6 sm:pb-2">
            <CardTitle className="text-[10px] sm:text-sm font-medium leading-tight">Total Revenue</CardTitle>
            <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 flex-shrink-0 ml-1" />
          </CardHeader>
          <CardContent className="p-2 pt-0 sm:p-6 sm:pt-0">
            <div className="text-base sm:text-2xl font-bold text-green-500 break-words">₹{analytics.totalRevenue.toLocaleString()}</div>
            <div className="flex items-center gap-1 text-[10px] sm:text-xs mt-1 flex-wrap">
              {analytics.revenueGrowth >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500 flex-shrink-0" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500 flex-shrink-0" />
              )}
              <span className={analytics.revenueGrowth >= 0 ? "text-green-500" : "text-red-500"}>
                {analytics.revenueGrowth >= 0 ? '+' : ''}{analytics.revenueGrowth}%
              </span>
              <span className="text-muted-foreground hidden sm:inline">vs previous</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-1 p-2 sm:p-6 sm:pb-2">
            <CardTitle className="text-[10px] sm:text-sm font-medium leading-tight">Approval Rate</CardTitle>
            <Percent className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500 flex-shrink-0 ml-1" />
          </CardHeader>
          <CardContent className="p-2 pt-0 sm:p-6 sm:pt-0">
            <div className="text-base sm:text-2xl font-bold text-blue-500 break-words">{analytics.approvalRate}%</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 text-nowrap">
              {analytics.completedCount}/{analytics.completedCount + analytics.rejectedCount}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-1 p-2 sm:p-6 sm:pb-2">
            <CardTitle className="text-[10px] sm:text-sm font-medium leading-tight">Avg Transaction</CardTitle>
            <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-purple-500 flex-shrink-0 ml-1" />
          </CardHeader>
          <CardContent className="p-2 pt-0 sm:p-6 sm:pt-0">
            <div className="text-base sm:text-2xl font-bold text-purple-500 break-words">₹{analytics.avgTransactionValue}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 hidden sm:block">
              Per completed
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-1 p-2 sm:p-6 sm:pb-2">
            <CardTitle className="text-[10px] sm:text-sm font-medium leading-tight">Pending</CardTitle>
            <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-amber-500 flex-shrink-0 ml-1" />
          </CardHeader>
          <CardContent className="p-2 pt-0 sm:p-6 sm:pt-0">
            <div className="text-base sm:text-2xl font-bold text-amber-500 break-words">₹{analytics.pendingRevenue.toLocaleString()}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 text-nowrap">
              {analytics.pendingCount} awaiting
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Proof Review Metrics */}
      {proofAnalytics && proofAnalytics.total > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Proofs</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-xl font-bold">{proofAnalytics.total}</div>
            </CardContent>
          </Card>
          <Card className="border-green-500/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-xl font-bold text-green-500">{proofAnalytics.approved}</div>
            </CardContent>
          </Card>
          <Card className="border-red-500/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-3 w-3 sm:h-4 sm:w-4 text-red-500" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-xl font-bold text-red-500">{proofAnalytics.rejected}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Review Time</CardTitle>
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-xl font-bold">{proofAnalytics.avgReviewTime}h</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Daily Revenue Chart */}
      <Card>
        <CardHeader className="p-3 sm:p-6">
          <CardTitle className="text-sm sm:text-base">Daily Revenue (Last 30 Days)</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Revenue trends and volume</CardDescription>
        </CardHeader>
        <CardContent className="p-2 sm:p-6 pt-0">
          <div className="h-48 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.dailyVolume}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  interval="preserveStartEnd"
                  className="text-muted-foreground"
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  width={40}
                  className="text-muted-foreground"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--primary))"
                  fill="url(#colorRevenue)"
                  name="Revenue (₹)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Transaction Status Distribution */}
        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-sm sm:text-base">Transaction Status</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Distribution of outcomes</CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-6 pt-0">
            <div className="h-48 sm:h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {analytics.statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-2 sm:mt-4">
              <Badge variant="outline" className="bg-[hsl(var(--chart-2))]/10 text-xs">
                <CheckCircle className="w-3 h-3 mr-1" />
                {analytics.completedCount}
              </Badge>
              <Badge variant="outline" className="bg-amber-500/10 text-xs">
                <Clock className="w-3 h-3 mr-1" />
                {analytics.pendingCount}
              </Badge>
              <Badge variant="outline" className="bg-destructive/10 text-xs">
                <XCircle className="w-3 h-3 mr-1" />
                {analytics.rejectedCount}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Revenue by Type */}
        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-sm sm:text-base">Revenue by Type</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Breakdown of sources</CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-6 pt-0">
            <div className="h-48 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.revenueByTypeData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={(value) => `₹${value}`} tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Revenue']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Methods & Weekly Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Payment Methods */}
        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-sm sm:text-base">Payment Methods</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Most used options</CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-6 pt-0">
            <div className="h-48 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.paymentMethodData}
                    cx="50%"
                    cy="50%"
                    outerRadius={60}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {analytics.paymentMethodData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Revenue Trends */}
        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-sm sm:text-base">Weekly Trends</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Last 8 weeks</CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-6 pt-0">
            <div className="h-48 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.weeklyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(value) => `₹${value}`} tick={{ fontSize: 10 }} width={45} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      name === 'revenue' ? `₹${value.toLocaleString()}` : value,
                      name === 'revenue' ? 'Revenue' : 'Transactions'
                    ]}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" name="Revenue" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
