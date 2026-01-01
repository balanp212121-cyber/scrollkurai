import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, XCircle, FileText, Eye, Clock, Shield, RefreshCw, Calendar, AlertCircle } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useQueryClient } from "@tanstack/react-query";
interface PaymentProof {
  id: string;
  user_id: string;
  transaction_id: string;
  file_path: string;
  file_name: string;
  status: string;
  uploaded_at: string;
  admin_note: string | null;
  profiles: {
    username: string;
  };
  payment_transactions: {
    amount: number;
    item_name: string;
    item_type: string;
  };
}

export function PaymentProofReview() {
  const queryClient = useQueryClient();
  const { data: isAdmin, isLoading: adminLoading } = useAdminCheck();
  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [viewingFileUrl, setViewingFileUrl] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchProofs();
  }, []);

  const fetchProofs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Fetch payment proofs (limited to 100 for performance at scale)
      // TODO: Add pagination with "load more" button when exceeding 100k users
      const { data: proofsData, error: proofsError } = await supabase
        .from('payment_proofs')
        .select(`
          *,
          payment_transactions!inner(amount, item_name, item_type)
        `)
        .order('uploaded_at', { ascending: false })
        .limit(100);

      if (proofsError) throw proofsError;

      if (!proofsData) {
        setProofs([]);
        return;
      }

      // Fetch user profiles for all user_ids using admin-safe RPC
      const userIds = [...new Set(proofsData.map(p => p.user_id))];
      const { data: profilesData } = await supabase.rpc('get_profiles_by_ids_admin', {
        user_ids: userIds
      });

      // Map profiles to proofs
      const proofsWithProfiles = proofsData.map(proof => {
        const profile = profilesData?.find(p => p.id === proof.user_id);
        return {
          ...proof,
          profiles: {
            username: profile?.username || 'Unknown User'
          }
        };
      });

      setProofs(proofsWithProfiles as any);
      if (silent) {
        toast.success("Refreshed payment proofs");
      }
    } catch (error) {
      console.error("Error fetching proofs:", error);
      if (!silent) {
        toast.error("Failed to load payment proofs");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchProofs(true);
  };

  const sendEmailNotification = async (
    userId: string,
    userName: string,
    itemName: string,
    amount: number,
    status: 'approved' | 'rejected',
    adminNote?: string
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-payment-notification', {
        body: {
          userId,
          userName,
          itemName,
          amount,
          currency: '₹',
          status,
          adminNote,
        },
      });

      if (error) {
        console.error('Email notification error:', error);
        return false;
      } else {
        console.log('Email notification sent:', data);
        return true;
      }
    } catch (err) {
      console.error('Failed to send email notification:', err);
      return false;
    }
  };

  const handleReview = async (proofId: string, action: 'approved' | 'rejected', durationDays?: number) => {
    // Safety check for rejections
    if (action === 'rejected' && !window.confirm("Are you sure you want to REJECT this payment proof? This action cannot be undone.")) {
      return;
    }

    setReviewingId(proofId);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const proof = proofs.find(p => p.id === proofId);
      if (!proof) throw new Error("Proof not found");

      // Idempotency check: prevent double-approval
      if (proof.status === 'approved' && action === 'approved') {
        toast.info('Already Approved', {
          description: 'This payment has already been approved',
        });
        setReviewingId(null);
        return;
      }

      // Update payment proof status
      const { error: updateError } = await supabase
        .from('payment_proofs')
        .update({
          status: action,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          admin_note: adminNote || null,
        })
        .eq('id', proofId);

      if (updateError) throw updateError;

      // Update payment transaction status
      const { error: transactionError } = await supabase
        .from('payment_transactions')
        .update({
          status: action === 'approved' ? 'completed' : 'rejected',
        })
        .eq('id', proof.transaction_id);

      if (transactionError) throw transactionError;

      // Create audit log (legacy table)
      const { error: auditError } = await supabase
        .from('payment_proof_audit')
        .insert({
          proof_id: proofId,
          reviewer_id: user.id,
          action: durationDays ? `${action}_${durationDays}d` : action,
          admin_note: adminNote || null,
        });

      if (auditError) throw auditError;

      // Unified admin audit log (fire-and-forget - failure doesn't block action)
      // Note: Table exists after migration, types regenerate with `supabase gen types`
      try {
        await (supabase as any).from('admin_audit_logs').insert({
          admin_user_id: user.id,
          action: action === 'approved' ? 'payment_approve' : 'payment_reject',
          target_type: 'payment_proof',
          target_id: proofId,
          metadata: {
            user_id: proof.user_id,
            amount: proof.payment_transactions.amount,
            item: proof.payment_transactions.item_name,
            duration_days: durationDays || null,
            note: adminNote || null
          }
        });
      } catch (e) {
        console.warn('Audit log failed (non-blocking):', e);
      }


      // If approved, enable purchased features
      if (action === 'approved') {
        const { data: transaction } = await supabase
          .from('payment_transactions')
          .select('*')
          .eq('id', proof.transaction_id)
          .single();

        if (transaction) {
          const activatedFeatures: string[] = [];

          // Handle Premium/Subscription purchases
          if (transaction.item_type.toLowerCase().includes('premium') || transaction.item_type.toLowerCase().includes('subscription')) {
            // Set expiration based on duration (default 30 days if not specified)
            const days = durationDays || 30;
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + days);

            // Use upsert to handle duplicate approvals gracefully (idempotency)
            const { error: subError } = await supabase
              .from('subscriptions')
              .upsert({
                user_id: proof.user_id,
                tier: 'premium',
                status: 'active',
                started_at: new Date().toISOString(),
                expires_at: expiresAt.toISOString(),
              }, {
                onConflict: 'user_id',
                ignoreDuplicates: false
              });

            if (subError) {
              console.error('Error creating subscription:', subError);
              toast.error('Failed to create subscription', {
                description: subError.message
              });
            } else {
              // Set premium status - this will trigger realtime update in user's UI
              const { error: premiumError } = await supabase.rpc('set_premium_status', {
                target_user_id: proof.user_id,
                new_status: true
              });

              if (!premiumError) {
                const durationLabel = days === 365 ? '1 Year' : days === 30 ? '1 Month' : `${days} Days`;
                activatedFeatures.push(`Premium Tier (${durationLabel})`);
              } else {
                console.error('Error setting premium status:', premiumError);
                toast.error('Failed to set premium status', {
                  description: premiumError.message
                });
              }

              // Award premium badges
              const { data: premiumBadges } = await supabase
                .from('badges')
                .select('id, name')
                .eq('requirement_type', 'premium_unlock')
                .eq('is_premium_only', true);

              if (premiumBadges && premiumBadges.length > 0) {
                const badgeInserts = premiumBadges.map(badge => ({
                  user_id: proof.user_id,
                  badge_id: badge.id,
                }));

                // Use upsert to avoid duplicate badge errors
                const { error: badgeError } = await supabase
                  .from('user_badges')
                  .upsert(badgeInserts, {
                    onConflict: 'user_id,badge_id',
                    ignoreDuplicates: true
                  });

                if (!badgeError) {
                  activatedFeatures.push(`${premiumBadges.length} Premium Badges`);
                }
              }
            }
          }

          // Handle Power-Up purchases (includes boosters, shields, etc.)
          if (transaction.item_type.toLowerCase().includes('power-up') ||
            transaction.item_type.toLowerCase().includes('booster') ||
            transaction.item_type.toLowerCase().includes('shield')) {

            const { data: powerUp } = await supabase
              .from('power_ups')
              .select('id, name')
              .eq('name', transaction.item_name)
              .single();

            if (powerUp) {
              const { error: powerUpError } = await supabase
                .from('user_power_ups')
                .insert({
                  user_id: proof.user_id,
                  power_up_id: powerUp.id,
                  quantity: 1
                });

              if (!powerUpError) {
                activatedFeatures.push(powerUp.name);
              }
            }
          }

          // Show detailed success message
          const featuresText = activatedFeatures.length > 0
            ? `Activated: ${activatedFeatures.join(', ')}`
            : 'Payment approved';

          toast.success('Payment Approved!', {
            description: featuresText,
            duration: 5000,
          });

          // Send prominent user notification about approval
          const isSubscription = transaction.item_type.toLowerCase().includes('premium') ||
            transaction.item_type.toLowerCase().includes('subscription');

          const durationLabel = durationDays === 365 ? '1 Year' : durationDays === 30 ? '1 Month' : '';

          await supabase.from('community_posts').insert({
            user_id: proof.user_id,
            content: isSubscription
              ? `🎉 Your ScrollKurai Pro${durationLabel ? ` (${durationLabel})` : ''} is active! Premium themes and features are now unlocked. ${activatedFeatures.join(', ')}.`
              : `🎉 Your payment for ${transaction.item_name} has been approved! ${activatedFeatures.join(', ')} are now active.`,
            is_anonymous: false,
            quest_content: null,
          });

          // Send email notification for approval
          const emailSent = await sendEmailNotification(
            proof.user_id,
            proof.profiles.username,
            transaction.item_name,
            transaction.amount,
            'approved'
          );
          if (emailSent) {
            toast.success('Email notification sent to user');
          }
        }
      } else {
        toast.success('Payment Rejected', {
          description: adminNote || 'The payment proof has been rejected',
        });

        // Notify user about rejection
        await supabase.from('community_posts').insert({
          user_id: proof.user_id,
          content: `❌ Your payment for ${proof.payment_transactions.item_name} was rejected. ${adminNote ? `Reason: ${adminNote}` : 'Please contact support.'}`,
          is_anonymous: false,
          quest_content: null,
        });

        // Send email notification for rejection
        const emailSent = await sendEmailNotification(
          proof.user_id,
          proof.profiles.username,
          proof.payment_transactions.item_name,
          proof.payment_transactions.amount,
          'rejected',
          adminNote
        );
        if (emailSent) {
          toast.success('Email notification sent to user');
        }
      }

      setAdminNote("");
      setReviewingId(null);
      // Invalidate related queries to refresh stats
      queryClient.invalidateQueries({ queryKey: ["admin-pending-proofs-count"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
      await fetchProofs();

    } catch (error) {
      console.error("Error reviewing proof:", error);
      toast.error("Review failed", {
        description: "Please try again"
      });
    } finally {
      setReviewingId(null);
    }
  };

  const viewFile = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('payment-proofs')
        .createSignedUrl(filePath, 300); // 5 minutes

      if (error) throw error;
      if (data?.signedUrl) {
        setViewingFileUrl(data.signedUrl);
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error("Error viewing file:", error);
      toast.error("Failed to load file");
    }
  };

  if (adminLoading || loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse text-center">Loading payment proofs...</div>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">
          <Shield className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <p>Access Denied: Admin privileges required</p>
        </div>
      </Card>
    );
  }

  const pendingProofs = proofs.filter(p => p.status === 'pending');
  const reviewedProofs = proofs.filter(p => p.status !== 'pending');

  return (
    <div className="space-y-6">
      {/* Header with Refresh Button */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {pendingProofs.length} pending • {reviewedProofs.length} reviewed
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Pending Proofs */}
      {pendingProofs.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-500" />
            Pending Review ({pendingProofs.length})
          </h3>

          {pendingProofs.map((proof) => (
            <Card key={proof.id} className="p-6 border-yellow-500/30 bg-yellow-500/5">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                        <Clock className="w-3 h-3 mr-1" />
                        Pending
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(proof.uploaded_at), "MMM dd, yyyy HH:mm")}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold">User: {proof.profiles.username}</p>
                      <p className="text-sm text-muted-foreground">
                        {proof.payment_transactions.item_name} - ₹{proof.payment_transactions.amount}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Type: {proof.payment_transactions.item_type}
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => viewFile(proof.file_path)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Proof
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{proof.file_name}</span>
                </div>

                <div className="space-y-2">
                  <Textarea
                    placeholder="Add admin note (optional)..."
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    disabled={reviewingId === proof.id}
                    rows={2}
                  />
                </div>

                {isAdmin && (
                  <div className="space-y-2">
                    {/* Premium subscription approval buttons */}
                    {(proof.payment_transactions.item_type.toLowerCase().includes('premium') ||
                      proof.payment_transactions.item_type.toLowerCase().includes('subscription')) && (
                        <>
                          {/* Show detected plan based on item name */}
                          {proof.payment_transactions.item_name.toLowerCase().includes('yearly') && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-sm">
                              <AlertCircle className="w-4 h-4 text-emerald-500" />
                              <span className="text-emerald-600">User selected: <strong>Yearly Plan (₹999)</strong></span>
                            </div>
                          )}
                          {proof.payment_transactions.item_name.toLowerCase().includes('monthly') && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg text-sm">
                              <AlertCircle className="w-4 h-4 text-green-500" />
                              <span className="text-green-600">User selected: <strong>Monthly Plan (₹99)</strong></span>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleReview(proof.id, 'approved', 30)}
                              disabled={reviewingId !== null}
                              className={`flex-1 ${proof.payment_transactions.item_name.toLowerCase().includes('monthly')
                                ? 'bg-green-600 hover:bg-green-700 ring-2 ring-green-400'
                                : 'bg-green-600/70 hover:bg-green-700'
                                }`}
                            >
                              <Calendar className="w-4 h-4 mr-2" />
                              Approve 1-Month
                            </Button>
                            <Button
                              onClick={() => handleReview(proof.id, 'approved', 365)}
                              disabled={reviewingId !== null}
                              className={`flex-1 ${proof.payment_transactions.item_name.toLowerCase().includes('yearly')
                                ? 'bg-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-400'
                                : 'bg-emerald-600/70 hover:bg-emerald-700'
                                }`}
                            >
                              <Calendar className="w-4 h-4 mr-2" />
                              Approve 1-Year
                            </Button>
                          </div>
                        </>
                      )}

                    {/* Non-premium items get simple approve button */}
                    {!(proof.payment_transactions.item_type.toLowerCase().includes('premium') ||
                      proof.payment_transactions.item_type.toLowerCase().includes('subscription')) && (
                        <Button
                          onClick={() => handleReview(proof.id, 'approved')}
                          disabled={reviewingId !== null}
                          className="w-full bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Approve Payment
                        </Button>
                      )}

                    {/* Reject button always visible */}
                    <Button
                      onClick={() => handleReview(proof.id, 'rejected')}
                      disabled={reviewingId !== null}
                      variant="destructive"
                      className="w-full"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject Payment
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Reviewed Proofs */}
      {reviewedProofs.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-muted-foreground">
            Recent Reviews ({reviewedProofs.length})
          </h3>

          {reviewedProofs.slice(0, 10).map((proof) => (
            <Card key={proof.id} className="p-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge className={
                      proof.status === 'approved'
                        ? "bg-green-500/20 text-green-500 border-green-500/30"
                        : "bg-red-500/20 text-red-500 border-red-500/30"
                    }>
                      {proof.status === 'approved' ? (
                        <CheckCircle className="w-3 h-3 mr-1" />
                      ) : (
                        <XCircle className="w-3 h-3 mr-1" />
                      )}
                      {proof.status}
                    </Badge>
                    <span className="text-sm font-medium">{proof.profiles.username}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {proof.payment_transactions.item_name} - ₹{proof.payment_transactions.amount}
                  </p>
                  {proof.admin_note && (
                    <p className="text-xs text-muted-foreground italic">
                      Note: {proof.admin_note}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => viewFile(proof.file_path)}
                >
                  <Eye className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {proofs.length === 0 && (
        <Card className="p-8 text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No payment proofs to review</p>
        </Card>
      )}
    </div>
  );
}
