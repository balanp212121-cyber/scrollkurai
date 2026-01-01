import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Check, Lock, Sparkles, Palette } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import confetti from "canvas-confetti";

// Preset avatar options
const AVATAR_PRESETS = [
  { id: "warrior", name: "Digital Warrior", emoji: "⚔️", bgColor: "from-red-500 to-orange-500" },
  { id: "sage", name: "Mindful Sage", emoji: "🧘", bgColor: "from-purple-500 to-indigo-500" },
  { id: "phoenix", name: "Rising Phoenix", emoji: "🔥", bgColor: "from-amber-500 to-red-500" },
  { id: "zen", name: "Zen Master", emoji: "☯️", bgColor: "from-slate-500 to-zinc-600" },
  { id: "nature", name: "Nature Spirit", emoji: "🌿", bgColor: "from-green-500 to-emerald-500" },
  { id: "cosmic", name: "Cosmic Explorer", emoji: "🌌", bgColor: "from-violet-500 to-purple-600" },
  { id: "ocean", name: "Ocean Calm", emoji: "🌊", bgColor: "from-cyan-500 to-blue-500" },
  { id: "sunrise", name: "Sunrise Energy", emoji: "🌅", bgColor: "from-yellow-400 to-orange-500" },
];

const BORDER_COLORS = [
  { id: "gold", name: "Royal Gold", color: "#FFD700", className: "ring-yellow-400" },
  { id: "platinum", name: "Platinum", color: "#E5E4E2", className: "ring-slate-300" },
  { id: "ruby", name: "Ruby Red", color: "#E0115F", className: "ring-red-500" },
  { id: "emerald", name: "Emerald", color: "#50C878", className: "ring-emerald-500" },
  { id: "sapphire", name: "Sapphire", color: "#0F52BA", className: "ring-blue-600" },
  { id: "amethyst", name: "Amethyst", color: "#9966CC", className: "ring-purple-500" },
];

interface UserAvatar {
  avatar_type: string;
  avatar_preset: string | null;
  border_color: string | null;
}

interface AvatarCustomizerProps {
  isPremium: boolean;
  onAvatarChange?: () => void;
}

export function AvatarCustomizer({ isPremium, onAvatarChange }: AvatarCustomizerProps) {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [selectedBorder, setSelectedBorder] = useState<string | null>(null);
  const [currentAvatar, setCurrentAvatar] = useState<UserAvatar | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentAvatar();
  }, []);

  const fetchCurrentAvatar = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("user_avatars")
        .select("avatar_type, avatar_preset, border_color")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setCurrentAvatar(data);
        setSelectedPreset(data.avatar_preset);
        setSelectedBorder(data.border_color);
      }
    } catch (error) {
      console.error("Error fetching avatar:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAvatar = async () => {
    if (!isPremium) {
      toast.error("Premium required", {
        description: "Upgrade to Premium to customize your avatar"
      });
      return;
    }

    if (!selectedPreset) {
      toast.error("Select an avatar", {
        description: "Please select an avatar style first"
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const avatarData = {
        user_id: user.id,
        avatar_type: "preset",
        avatar_preset: selectedPreset,
        border_color: selectedBorder,
      };

      const { error } = await supabase
        .from("user_avatars")
        .upsert(avatarData, { onConflict: "user_id" });

      if (error) throw error;

      confetti({
        particleCount: 60,
        spread: 50,
        origin: { y: 0.6 }
      });

      toast.success("Avatar updated!", {
        description: "Your new avatar is now active"
      });

      setCurrentAvatar({
        avatar_type: "preset",
        avatar_preset: selectedPreset,
        border_color: selectedBorder,
      });

      onAvatarChange?.();
    } catch (error) {
      console.error("Error saving avatar:", error);
      toast.error("Failed to save avatar");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = 
    selectedPreset !== currentAvatar?.avatar_preset || 
    selectedBorder !== currentAvatar?.border_color;

  if (loading) {
    return <div className="text-center text-muted-foreground py-4">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Avatar Customizer</h3>
        </div>
        {isPremium && (
          <Badge className="bg-gold/20 text-gold border-gold/30">
            <Crown className="w-3 h-3 mr-1" />
            Premium
          </Badge>
        )}
      </div>

      {/* Current Avatar Preview */}
      <Card className="p-4 bg-gradient-to-br from-primary/10 to-accent/10">
        <div className="flex items-center gap-4">
          <div className="relative">
            <AvatarPreview 
              preset={selectedPreset} 
              borderColor={selectedBorder}
              size="lg"
            />
            {isPremium && (
              <Sparkles className="w-4 h-4 text-gold absolute -top-1 -right-1" />
            )}
          </div>
          <div>
            <p className="font-medium">Current Preview</p>
            <p className="text-sm text-muted-foreground">
              {selectedPreset 
                ? AVATAR_PRESETS.find(p => p.id === selectedPreset)?.name || "Custom"
                : "Default Avatar"}
            </p>
          </div>
        </div>
      </Card>

      {/* Avatar Presets */}
      <div className="space-y-3">
        <h4 className="font-medium text-sm text-muted-foreground">Choose Avatar Style</h4>
        <div className="grid grid-cols-4 gap-3">
          {AVATAR_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => isPremium && setSelectedPreset(preset.id)}
              disabled={!isPremium}
              className={`relative p-3 rounded-xl transition-all ${
                selectedPreset === preset.id
                  ? "ring-2 ring-primary bg-primary/10 scale-105"
                  : isPremium
                    ? "bg-card hover:bg-accent/20 hover:scale-105"
                    : "bg-muted/50 opacity-60 cursor-not-allowed"
              }`}
            >
              <div className={`w-12 h-12 mx-auto rounded-full bg-gradient-to-br ${preset.bgColor} flex items-center justify-center text-2xl shadow-lg`}>
                {preset.emoji}
              </div>
              <p className="text-xs mt-2 text-center truncate">{preset.name}</p>
              {selectedPreset === preset.id && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
              {!isPremium && (
                <Lock className="w-3 h-3 absolute top-1 right-1 text-muted-foreground" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Border Colors */}
      <div className="space-y-3">
        <h4 className="font-medium text-sm text-muted-foreground">Border Color</h4>
        <div className="flex flex-wrap gap-3">
          {BORDER_COLORS.map((border) => (
            <button
              key={border.id}
              onClick={() => isPremium && setSelectedBorder(
                selectedBorder === border.id ? null : border.id
              )}
              disabled={!isPremium}
              className={`relative p-2 rounded-lg transition-all ${
                selectedBorder === border.id
                  ? "ring-2 ring-primary bg-primary/10"
                  : isPremium
                    ? "bg-card hover:bg-accent/20"
                    : "bg-muted/50 opacity-60 cursor-not-allowed"
              }`}
            >
              <div 
                className="w-8 h-8 rounded-full shadow-md"
                style={{ backgroundColor: border.color }}
              />
              <p className="text-[10px] mt-1 text-center">{border.name}</p>
              {selectedBorder === border.id && (
                <Check className="w-3 h-3 absolute -top-1 -right-1 text-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Save Button */}
      {isPremium ? (
        <Button 
          onClick={handleSaveAvatar}
          disabled={saving || !hasChanges}
          className="w-full bg-gradient-to-r from-gold to-amber-500 hover:from-gold/90 hover:to-amber-500/90 text-black"
        >
          {saving ? "Saving..." : hasChanges ? "Save Avatar" : "No Changes"}
        </Button>
      ) : (
        <Card className="p-4 bg-gradient-to-r from-primary/20 to-accent/20 border-primary/30 text-center">
          <Lock className="w-6 h-6 mx-auto mb-2 text-primary" />
          <p className="text-sm font-medium">Upgrade to Premium</p>
          <p className="text-xs text-muted-foreground">Unlock avatar customization</p>
        </Card>
      )}
    </div>
  );
}

// Reusable Avatar Preview Component
interface AvatarPreviewProps {
  preset: string | null;
  borderColor?: string | null;
  size?: "sm" | "md" | "lg";
  username?: string;
}

export function AvatarPreview({ preset, borderColor, size = "md", username }: AvatarPreviewProps) {
  const presetData = AVATAR_PRESETS.find(p => p.id === preset);
  const borderData = BORDER_COLORS.find(b => b.id === borderColor);
  
  const sizeClasses = {
    sm: "w-8 h-8 text-base",
    md: "w-12 h-12 text-xl",
    lg: "w-16 h-16 text-3xl",
  };

  const borderSizes = {
    sm: "ring-2",
    md: "ring-2",
    lg: "ring-4",
  };

  if (!presetData) {
    // Default avatar with first letter
    const initial = username?.charAt(0)?.toUpperCase() || "?";
    return (
      <div 
        className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-primary-foreground ${borderColor && borderData ? `${borderSizes[size]} ${borderData.className}` : ""}`}
      >
        {initial}
      </div>
    );
  }

  return (
    <div 
      className={`${sizeClasses[size]} rounded-full bg-gradient-to-br ${presetData.bgColor} flex items-center justify-center shadow-lg ${borderColor && borderData ? `${borderSizes[size]} ${borderData.className}` : ""}`}
    >
      {presetData.emoji}
    </div>
  );
}

// Hook to get user's avatar
export function useUserAvatar(userId?: string) {
  const [avatar, setAvatar] = useState<UserAvatar | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAvatar = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await supabase
          .from("user_avatars")
          .select("avatar_type, avatar_preset, border_color")
          .eq("user_id", userId)
          .maybeSingle();

        setAvatar(data);
      } catch (error) {
        console.error("Error fetching user avatar:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAvatar();
  }, [userId]);

  return { avatar, loading };
}

// Export presets for use elsewhere
export { AVATAR_PRESETS, BORDER_COLORS };
