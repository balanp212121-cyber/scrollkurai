import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Share2, Users, Facebook, Twitter, MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ReferralStats {
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  totalXpEarned: number;
}

export const ReferralCard = () => {
  const [referralCode, setReferralCode] = useState<string>("");
  const [referralLink, setReferralLink] = useState<string>("");
  const [stats, setStats] = useState<ReferralStats>({
    totalReferrals: 0,
    completedReferrals: 0,
    pendingReferrals: 0,
    totalXpEarned: 0,
  });
  const [showQR, setShowQR] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrCreateReferralCode();
    fetchReferralStats();
  }, []);

  const fetchOrCreateReferralCode = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user already has a referral code
      let { data: existingCode, error: fetchError } = await supabase
        .from("referral_codes")
        .select("code")
        .eq("user_id", user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      let code = existingCode?.code;

      // Create new code if doesn't exist
      if (!code) {
        code = generateReferralCode();
        const { error: insertError } = await supabase
          .from("referral_codes")
          .insert({ user_id: user.id, code });

        if (insertError) throw insertError;
      }

      setReferralCode(code);
      setReferralLink(`${window.location.origin}/auth?ref=${code}`);
    } catch (error) {
      console.error("Error fetching referral code:", error);
      toast.error("Failed to load referral code");
    } finally {
      setLoading(false);
    }
  };

  const fetchReferralStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: referrals, error } = await supabase
        .from("referrals")
        .select("status")
        .eq("referrer_id", user.id);

      if (error) throw error;

      const completed = referrals?.filter(r => r.status === "rewarded" || r.status === "day_1_completed").length || 0;
      const pending = referrals?.filter(r => r.status === "pending").length || 0;

      setStats({
        totalReferrals: referrals?.length || 0,
        completedReferrals: completed,
        pendingReferrals: pending,
        totalXpEarned: completed * 500,
      });
    } catch (error) {
      console.error("Error fetching referral stats:", error);
    }
  };

  const generateReferralCode = (): string => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success("Referral link copied to clipboard!");
  };

  const shareReferral = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join me on Quest!",
          text: "Complete daily quests, earn XP, and level up with me! Use my referral code to get started.",
          url: referralLink,
        });
      } catch (error) {
        console.error("Error sharing:", error);
      }
    } else {
      copyToClipboard();
    }
  };

  const shareOnWhatsApp = () => {
    const message = `Join me on ScrollKurai! Complete daily quests, earn XP, and level up together. Use my referral link: ${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const shareOnFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`, '_blank');
  };

  const shareOnTwitter = () => {
    const text = `Join me on ScrollKurai! Stop mindless scrolling and start building the life you actually want 🎯`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(referralLink)}`, '_blank');
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-3/4"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
      </Card>
    );
  }

  const progress = (stats.completedReferrals / 3) * 100;

  return (
    <>
      <Card className="p-6 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="text-xl font-semibold">Invite Friends, Earn Rewards</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Earn 500 XP for each friend who completes their first quest. Invite 3 friends to unlock the Social Warrior badge!
          </p>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <p className="text-sm font-medium">Your Referral Code</p>
            <div className="flex gap-2">
              <code className="flex-1 px-3 py-2 bg-background rounded border text-lg font-mono text-center">
                {referralCode}
              </code>
              <Button size="icon" variant="outline" onClick={() => setShowQR(true)}>
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={copyToClipboard} className="flex-1" variant="outline">
              <Copy className="w-4 h-4 mr-2" />
              Copy Link
            </Button>
            <Button onClick={shareReferral} className="flex-1">
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress to Social Warrior Badge</span>
            <span className="font-medium">{stats.completedReferrals} / 3</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{stats.totalReferrals}</p>
            <p className="text-xs text-muted-foreground">Total Invited</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{stats.completedReferrals}</p>
            <p className="text-xs text-muted-foreground">Completed Day 1</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{stats.totalXpEarned}</p>
            <p className="text-xs text-muted-foreground">XP Earned</p>
          </div>
        </div>
      </Card>

      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share Your Referral QR Code</DialogTitle>
            <DialogDescription>
              Friends can scan this QR code to join using your referral link
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 p-6">
            <div className="p-4 bg-white rounded-lg shadow-sm">
              <QRCodeSVG 
                value={referralLink} 
                size={256} 
                level="H"
                bgColor="#ffffff"
                fgColor="#000000"
                includeMargin={true}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Scan with your phone camera to open the referral link
            </p>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 border-t border-border"></div>
              <span className="text-xs text-muted-foreground">Share on social media</span>
              <div className="flex-1 border-t border-border"></div>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <Button onClick={shareOnWhatsApp} variant="outline" className="flex-col h-auto py-3">
                <MessageCircle className="w-5 h-5 mb-1 text-green-600" />
                <span className="text-xs">WhatsApp</span>
              </Button>
              <Button onClick={shareOnFacebook} variant="outline" className="flex-col h-auto py-3">
                <Facebook className="w-5 h-5 mb-1 text-blue-600" />
                <span className="text-xs">Facebook</span>
              </Button>
              <Button onClick={shareOnTwitter} variant="outline" className="flex-col h-auto py-3">
                <Twitter className="w-5 h-5 mb-1 text-sky-500" />
                <span className="text-xs">Twitter</span>
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={copyToClipboard} className="flex-1" variant="outline">
              <Copy className="w-4 h-4 mr-2" />
              Copy Link
            </Button>
            <Button onClick={shareReferral} className="flex-1">
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};