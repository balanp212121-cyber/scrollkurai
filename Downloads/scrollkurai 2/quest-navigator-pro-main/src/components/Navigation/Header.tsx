import { Link } from "react-router-dom";
import { Sparkles, Crown, Zap, MessageCircle, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isFeatureEnabled } from "@/lib/featureFlags";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { AvatarPreview } from "@/components/Profile/AvatarCustomizer";
import { ActivePowerUpIndicator } from "@/components/PowerUps/ActivePowerUpIndicator";
interface UserAvatar {
  avatar_preset: string | null;
  border_color: string | null;
}

export function Header() {
  const showPremium = isFeatureEnabled("enable_premium_tier");
  const showPowerUps = isFeatureEnabled("enable_power_ups");
  const [isPremium, setIsPremium] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<UserAvatar | null>(null);

  useEffect(() => {
    const fetchUserStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        
        const { data: profile } = await supabase
          .from("profiles")
          .select("premium_status, username")
          .eq("id", user.id)
          .single();
        
        if (profile) {
          setIsPremium(profile.premium_status || false);
          setUsername(profile.username);
        }

        // Fetch user avatar
        const { data: avatarData } = await supabase
          .from("user_avatars")
          .select("avatar_preset, border_color")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (avatarData) {
          setUserAvatar(avatarData);
        }
      }
    };

    fetchUserStatus();

    // Listen for profile and avatar changes
    const setupRealtimeSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const profileChannel = supabase
        .channel('header-profile-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.new.premium_status !== payload.old.premium_status) {
              setIsPremium(payload.new.premium_status || false);
            }
            if (payload.new.username !== payload.old.username) {
              setUsername(payload.new.username);
            }
          }
        )
        .subscribe();

      const avatarChannel = supabase
        .channel('header-avatar-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_avatars',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.new) {
              setUserAvatar({
                avatar_preset: (payload.new as any).avatar_preset,
                border_color: (payload.new as any).border_color,
              });
            }
          }
        )
        .subscribe();

      return { profileChannel, avatarChannel };
    };

    const channelsPromise = setupRealtimeSubscription();

    return () => {
      channelsPromise.then((channels) => {
        if (channels) {
          supabase.removeChannel(channels.profileChannel);
          supabase.removeChannel(channels.avatarChannel);
        }
      });
    };
  }, []);

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between max-w-lg">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            ScrollKurai
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {showPowerUps && <ActivePowerUpIndicator />}
          <Link to="/community">
            <Button variant="ghost" size="sm" className="gap-2">
              <MessageCircle className="w-4 h-4" />
            </Button>
          </Link>
          {showPowerUps && (
            <Link to="/power-ups">
              <Button variant="ghost" size="sm" className="gap-2">
                <Zap className="w-4 h-4 text-gold" />
              </Button>
            </Link>
          )}
          {showPremium && (
            <Link to="/premium">
              <Button variant="ghost" size="sm" className="gap-2 text-gold hover:text-gold">
                <Crown className="w-4 h-4" />
              </Button>
            </Link>
          )}
          <Link to="/profile">
            <div className="relative">
              <AvatarPreview 
                preset={userAvatar?.avatar_preset || null}
                borderColor={userAvatar?.border_color || null}
                size="sm"
                username={username || undefined}
              />
              {isPremium && (
                <Crown className="w-3 h-3 text-gold absolute -top-1 -right-1 drop-shadow-md" />
              )}
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
}
