import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Users, Share2, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

interface OnboardingInviteProps {
  onSkip: () => void;
  onComplete: () => void;
}

export const OnboardingInvite = ({ onSkip, onComplete }: OnboardingInviteProps) => {
  const [referralCode, setReferralCode] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchOrCreateReferralCode();
  }, []);

  const fetchOrCreateReferralCode = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: existingCode } = await supabase
        .from('referral_codes')
        .select('code')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingCode) {
        setReferralCode(existingCode.code);
      } else {
        const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const { data, error } = await supabase
          .from('referral_codes')
          .upsert({
            user_id: user.id,
            code: newCode,
          }, {
            onConflict: 'user_id',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (!error && data) {
          setReferralCode(data.code);
        } else if (error) {
          console.error('Error creating referral code:', error);
          // Fallback: fetch again in case of race condition
          const { data: fallbackCode } = await supabase
            .from('referral_codes')
            .select('code')
            .eq('user_id', user.id)
            .maybeSingle();
          if (fallbackCode) setReferralCode(fallbackCode.code);
        }
      }
    } catch (error) {
      console.error('Error fetching referral code:', error);
    }
  };

  const handleCopy = () => {
    const shareUrl = `${window.location.origin}?ref=${referralCode}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}?ref=${referralCode}`;
    const text = "Join me on this journey to transform brain rot into true potential! 🚀";

    if (navigator.share) {
      navigator.share({ title: 'Join Me', text, url: shareUrl });
    } else {
      handleCopy();
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Users className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold">Invite Friends</h2>
          <p className="text-muted-foreground text-sm sm:text-base">
            Earn 500 XP for every friend who completes their first day!
          </p>
        </div>

        <Card className="p-4 sm:p-6 max-w-md mx-auto space-y-4">
          <div className="flex justify-center">
            {referralCode && (
              <QRCodeSVG
                value={`${window.location.origin}?ref=${referralCode}`}
                size={150}
                level="M"
                className="rounded-lg"
              />
            )}
          </div>

          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">Your referral code:</p>
            <p className="text-2xl font-bold text-primary">{referralCode}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={handleCopy} className="gap-2 w-full">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy Link"}
            </Button>
            <Button onClick={handleShare} className="gap-2 w-full">
              <Share2 className="w-4 h-4" />
              Share
            </Button>
          </div>
        </Card>
      </div>

      <div className="sticky bottom-0 flex-shrink-0 p-4 border-t bg-background/95 backdrop-blur z-10 pb-[calc(1rem_+_env(safe-area-inset-bottom,0px))] sm:pb-6">
        <div className="flex justify-center gap-4">
          <Button variant="ghost" onClick={onSkip} className="flex-1 sm:flex-none">
            Skip for Now
          </Button>
          <Button onClick={onComplete} className="px-8 flex-[2] sm:flex-none">
            All Done!
          </Button>
        </div>
      </div>
    </div>
  );
};
