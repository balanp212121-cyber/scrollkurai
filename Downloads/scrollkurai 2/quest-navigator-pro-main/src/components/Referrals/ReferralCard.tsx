import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Share2, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
);

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.791-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
);

const TwitterIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.161a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" /></svg>
);

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
              <Button onClick={shareOnWhatsApp} variant="outline" className="flex-col h-auto py-3 dark:hover:bg-green-950/20 hover:bg-green-50">
                <WhatsAppIcon className="w-6 h-6 mb-1 text-[#25D366]" />
                <span className="text-xs font-medium">WhatsApp</span>
              </Button>
              <Button onClick={shareOnFacebook} variant="outline" className="flex-col h-auto py-3 dark:hover:bg-blue-950/20 hover:bg-blue-50">
                <FacebookIcon className="w-6 h-6 mb-1 text-[#1877F2]" />
                <span className="text-xs font-medium">Facebook</span>
              </Button>
              <Button onClick={shareOnTwitter} variant="outline" className="flex-col h-auto py-3 dark:hover:bg-sky-950/20 hover:bg-sky-50">
                <TwitterIcon className="w-6 h-6 mb-1 text-[#1DA1F2]" />
                <span className="text-xs font-medium">Twitter</span>
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