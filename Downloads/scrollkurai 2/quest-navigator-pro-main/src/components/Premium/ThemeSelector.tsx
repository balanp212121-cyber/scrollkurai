import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Crown, Check, Lock } from "lucide-react";

interface Theme {
  id: string;
  name: string;
  display_name: string;
  description: string;
  is_premium_only: boolean;
  color_primary: string;
  color_accent: string;
  color_background: string;
}

interface ThemeSelectorProps {
  isPremium: boolean;
}

export function ThemeSelector({ isPremium }: ThemeSelectorProps) {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectingThemeId, setSelectingThemeId] = useState<string | null>(null);
  const [currentPremiumStatus, setCurrentPremiumStatus] = useState(isPremium);

  useEffect(() => {
    fetchThemes();

    // Listen for premium status changes to immediately unlock themes
    const setupRealtimeSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const channel = supabase
        .channel('theme-selector-profile-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`,
          },
          async (payload) => {
            if (payload.new.premium_status !== payload.old.premium_status) {
              setCurrentPremiumStatus(payload.new.premium_status || false);

              // Refresh session to ensure server sees updated premium status
              await supabase.auth.refreshSession();

              // Refresh themes to show newly unlocked options
              fetchThemes();
            }
          }
        )
        .subscribe();

      return channel;
    };

    const channelPromise = setupRealtimeSubscription();

    return () => {
      channelPromise.then((channel) => {
        if (channel) {
          supabase.removeChannel(channel);
        }
      });
    };
  }, []);

  // Update premium status when prop changes
  useEffect(() => {
    setCurrentPremiumStatus(isPremium);
  }, [isPremium]);

  const fetchThemes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all themes
      const { data: themesData, error: themesError } = await supabase
        .from("premium_themes")
        .select("*")
        .order("is_premium_only", { ascending: true });

      if (themesError) throw themesError;

      // Fetch user's selected theme
      const { data: userTheme } = await supabase
        .from("user_theme_selection")
        .select("theme_id")
        .eq("user_id", user.id)
        .single();

      setThemes(themesData || []);

      // Find the "Default" theme to use as fallback for users without a selection
      const defaultTheme = themesData?.find((t: Theme) =>
        t.name === 'default' || t.display_name === 'Default Theme' || !t.is_premium_only
      );
      setSelectedThemeId(userTheme?.theme_id || defaultTheme?.id || themesData?.[0]?.id || null);
    } catch (error) {
      console.error("Error fetching themes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTheme = async (themeId: string, theme: Theme) => {
    if (theme.is_premium_only && !currentPremiumStatus) {
      toast.error("Premium Required", {
        description: "This theme is exclusive to premium members. Upgrade to ScrollKurai Pro to unlock.",
      });
      return;
    }

    setSelectingThemeId(themeId);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Authentication required");
        return;
      }

      // Server-side validation: Verify premium status and persist selection
      const { error } = await supabase
        .from("user_theme_selection")
        .upsert({
          user_id: user.id,
          theme_id: themeId,
          selected_at: new Date().toISOString(),
        }, {
          onConflict: "user_id"
        });

      if (error) {
        // RLS policy will reject if user doesn't have premium_status for premium themes
        if (error.code === 'PGRST301' || error.message.includes('violates')) {
          // Check if user is actually premium - if not, show upgrade message instead of "verification failed"
          if (!currentPremiumStatus) {
            toast.error("Premium Required", {
              description: "Upgrade to ScrollKurai Pro to unlock this theme",
            });
          } else {
            // Premium user but subscription check failed - might be expired
            toast.error("Subscription Issue", {
              description: "Please refresh the page or contact support if your premium subscription is active",
            });
          }
        } else {
          throw error;
        }
        return;
      }

      // Track analytics event
      try {
        await supabase.functions.invoke('track-analytics', {
          body: {
            event: 'theme_selected',
            theme_id: themeId,
            theme_name: theme.name,
            is_premium: theme.is_premium_only
          }
        });
      } catch (analyticsError) {
        console.error("Analytics tracking failed:", analyticsError);
        // Don't block user experience if analytics fails
      }

      setSelectedThemeId(themeId);
      toast.success("Theme Applied!", {
        description: `Your theme has been changed to ${theme.display_name}`,
      });
    } catch (error) {
      console.error("Error selecting theme:", error);
      toast.error("Failed to apply theme", {
        description: "Please try again or contact support if the issue persists",
      });
    } finally {
      setSelectingThemeId(null);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-muted rounded w-1/3 mb-4" />
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-muted rounded-lg" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-primary/20">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Themes</h2>
        {!currentPremiumStatus && (
          <Badge className="bg-gold/20 text-gold border-gold/30">
            <Crown className="w-3 h-3 mr-1" />
            Premium Feature
          </Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        {currentPremiumStatus
          ? "Choose your favorite theme to personalize your experience"
          : "Unlock premium themes with ScrollKurai Pro"}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {themes.map((theme) => {
          const isSelected = theme.id === selectedThemeId;
          const isLocked = theme.is_premium_only && !currentPremiumStatus;

          return (
            <div
              key={theme.id}
              className={`relative rounded-lg border-2 transition-all ${isSelected
                ? "border-primary shadow-lg shadow-primary/20"
                : "border-border hover:border-primary/50"
                } ${isLocked ? "opacity-60" : ""}`}
            >
              {/* Theme Preview */}
              <div
                className="h-24 rounded-t-lg p-4 flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${theme.color_primary}, ${theme.color_accent})`,
                }}
              >
                <div className="text-center text-white">
                  <p className="font-bold text-lg">{theme.display_name}</p>
                  <p className="text-xs opacity-80">{theme.description}</p>
                </div>
              </div>

              {/* Theme Info */}
              <div className="p-4 bg-card rounded-b-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {theme.is_premium_only && (
                      <Badge className="bg-gold/20 text-gold border-gold/30 text-xs">
                        <Crown className="w-3 h-3 mr-1" />
                        Premium
                      </Badge>
                    )}
                  </div>
                  {isSelected && (
                    <Badge className="bg-primary/20 text-primary border-primary/30">
                      <Check className="w-3 h-3 mr-1" />
                      Active
                    </Badge>
                  )}
                </div>

                {isLocked ? (
                  // Non-premium user on premium theme: show static locked text
                  <div className="w-full py-2 px-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                    <Lock className="w-4 h-4" />
                    Locked
                  </div>
                ) : (
                  // Premium user or free theme: show clickable button
                  <Button
                    onClick={() => handleSelectTheme(theme.id, theme)}
                    disabled={selectingThemeId === theme.id}
                    variant={isSelected ? "default" : "outline"}
                    className="w-full"
                    size="sm"
                  >
                    {selectingThemeId === theme.id ? (
                      <>
                        <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Applying...
                      </>
                    ) : isSelected ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Selected
                      </>
                    ) : theme.is_premium_only ? (
                      "Apply Theme"
                    ) : (
                      "Select Theme"
                    )}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!currentPremiumStatus && (
        <div className="mt-6 p-4 bg-gold/10 border border-gold/30 rounded-lg">
          <p className="text-sm text-center text-muted-foreground">
            💎 Unlock all premium themes with ScrollKurai Pro
          </p>
        </div>
      )}
    </Card>
  );
}
