import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { NotificationSettings } from "@/components/Settings/NotificationSettings";
import { ThemeSelector } from "@/components/Premium/ThemeSelector";
import { PremiumWelcomeModal } from "@/components/Premium/PremiumWelcomeModal";
import { AvatarCustomizer, AvatarPreview } from "@/components/Profile/AvatarCustomizer";
import { User, TrendingUp, Award, Calendar, Edit, LogOut, Receipt, Shield, Crown, Clock, Palette } from "lucide-react";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useNavigate } from "react-router-dom";

interface Profile {
  id: string;
  username: string | null;
  archetype: string;
  xp: number;
  level: number;
  streak: number;
  total_quests_completed: number;
  quiz_completed: boolean;
  brain_rot_score: number;
  premium_status: boolean;
  created_at: string;
}

interface Subscription {
  expires_at: string | null;
  started_at: string;
  status: string;
}

interface LeaderboardEntry {
  id: string;
  username: string | null;
  xp: number;
  level: number;
}

interface UserAvatar {
  avatar_preset: string | null;
  border_color: string | null;
}

const usernameSchema = z.object({
  username: z.string().trim().min(3, "Username must be at least 3 characters").max(20, "Username must be less than 20 characters"),
});

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [globalRank, setGlobalRank] = useState<number | null>(null);
  const [userAvatar, setUserAvatar] = useState<UserAvatar | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showPremiumWelcome, setShowPremiumWelcome] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: isAdmin } = useAdminCheck();

  const form = useForm<z.infer<typeof usernameSchema>>({
    resolver: zodResolver(usernameSchema),
    defaultValues: {
      username: "",
    },
  });

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (data) {
        setProfile(data);
        form.setValue("username", data.username || "");

        // Fetch user avatar
        const { data: avatarData } = await supabase
          .from("user_avatars")
          .select("avatar_preset, border_color")
          .eq("user_id", user.id)
          .maybeSingle();

        if (avatarData) {
          setUserAvatar(avatarData);
        }

        // Fetch subscription data if premium
        if (data.premium_status) {
          const { data: subData } = await supabase
            .from("subscriptions")
            .select("expires_at, started_at, status")
            .eq("user_id", user.id)
            .eq("status", "active")
            .order("expires_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (subData) {
            setSubscription(subData);
          }
        }

        // Fetch global rank
        const { data: leaderboardData } = await supabase
          .rpc("get_public_profiles", {
            order_by: "xp",
            limit_count: 1000
          });

        if (leaderboardData) {
          const rank = (leaderboardData as LeaderboardEntry[]).findIndex((entry) => entry.id === user.id) + 1;
          setGlobalRank(rank > 0 ? rank : null);
        }
      }
    }
  };

  useEffect(() => {
    fetchProfile();

    // Subscribe to profile changes (e.g., when premium is activated)
    const setupRealtimeSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel('profile-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            console.log('Profile updated:', payload);
            // Refresh profile data when premium_status or other fields change
            fetchProfile();

            // Show notification and welcome modal if premium was just activated
            if (payload.new.premium_status && !payload.old.premium_status) {
              toast({
                title: "🎉 ScrollKurai Pro Activated!",
                description: "Premium themes and features are now unlocked",
                duration: 5000,
              });

              // Show welcome modal if not seen before
              const hasSeenWelcome = localStorage.getItem('premium_welcome_shown');
              if (!hasSeenWelcome) {
                setShowPremiumWelcome(true);
              }
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

  const onSubmit = async (values: z.infer<typeof usernameSchema>) => {
    if (!profile) return;

    const { error } = await (supabase as any)
      .from("profiles")
      .update({ username: values.username })
      .eq("id", profile.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update username",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success!",
        description: "Username updated successfully",
      });
      setIsDialogOpen(false);
      fetchProfile();
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed out",
      description: "You have been signed out successfully",
    });
    navigate("/auth");
  };

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-20">
        <div className="animate-pulse text-primary text-xl">Loading profile...</div>
      </div>
    );
  }

  const archetypeProgress = {
    "Certified Brain Rotter": 0,
    "Mind Wanderer": 20,
    "Balanced Thinker": 40,
    "Focus Initiator": 60,
    "True Potential Seeker": 80,
  };

  const currentProgress = archetypeProgress[profile.archetype as keyof typeof archetypeProgress] || 0;
  const nextArchetype = Object.entries(archetypeProgress).find(([_, value]) => value > currentProgress)?.[0];

  return (
    <div className="pb-20 space-y-6">
      {/* Premium Welcome Modal */}
      <PremiumWelcomeModal
        isOpen={showPremiumWelcome}
        onClose={() => setShowPremiumWelcome(false)}
      />

      {/* Profile Header */}
      <div className="flex items-center gap-3">
        <User className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Your Profile
          </h1>
          <p className="text-sm text-muted-foreground">Track your evolution</p>
        </div>
      </div>

      {/* Main Stats Card */}
      <Card className="p-4 sm:p-6 bg-gradient-to-br from-card to-card/50 border-primary/20 overflow-hidden">
        <div className="space-y-4 sm:space-y-6">
          {/* Top Row: Avatar + Name + Edit Button */}
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Custom Avatar */}
            <AvatarPreview
              preset={userAvatar?.avatar_preset || null}
              borderColor={userAvatar?.border_color || null}
              size="lg"
              username={profile.username || undefined}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-2xl font-bold truncate">{profile.username || "Warrior"}</h2>
                {profile.premium_status && (
                  <Badge className="bg-gold/20 text-gold border-gold/30 shrink-0">
                    <Crown className="w-3 h-3 mr-1" />
                    Pro
                  </Badge>
                )}
                {profile.xp >= 1000 && (
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                        <Edit className="w-3 h-3" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Change Username</DialogTitle>
                        <DialogDescription>
                          You've unlocked the ability to change your username! (1000+ XP)
                        </DialogDescription>
                      </DialogHeader>
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                          <FormField
                            control={form.control}
                            name="username"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>New Username</FormLabel>
                                <FormControl>
                                  <Input placeholder="Enter your new username" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <DialogFooter>
                            <Button type="submit">Save Changes</Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              <Badge className="mt-1 bg-primary/20 text-primary border-primary/30">
                Level {profile.level}
              </Badge>
            </div>
          </div>

          {/* XP Display - Full width on mobile */}
          <div className="bg-primary/10 rounded-lg p-3 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-primary">{profile.xp} XP</p>
            <p className="text-xs sm:text-sm text-muted-foreground">Total Experience</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1 sm:space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-accent shrink-0" />
                <p className="text-xs sm:text-sm text-muted-foreground">Current Streak</p>
              </div>
              <p className="text-xl sm:text-2xl font-bold">{profile.streak} days</p>
            </div>
            <div className="space-y-1 sm:space-y-2">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-gold shrink-0" />
                <p className="text-xs sm:text-sm text-muted-foreground">Quests Completed</p>
              </div>
              <p className="text-xl sm:text-2xl font-bold">{profile.total_quests_completed}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Global Rank */}
      {globalRank && (
        <Card className="p-6 bg-gradient-to-br from-gold/10 to-accent/10 border-gold/20">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-gold" />
            Global Ranking
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Your Global Rank</span>
              <span className="text-3xl font-bold text-gold">#{globalRank}</span>
            </div>
            {globalRank <= 50 && (
              <Badge className="bg-gold/20 text-gold border-gold/30 w-full justify-center">
                🏆 Top 50 Warrior
              </Badge>
            )}
          </div>
        </Card>
      )}

      {/* Premium Subscription Status */}
      {profile.premium_status && subscription && (
        <Card className="p-6 bg-gradient-to-br from-gold/10 to-primary/10 border-gold/20">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Crown className="w-5 h-5 text-gold" />
            Premium Subscription
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                Active
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Started</span>
              <span className="text-sm font-medium">
                {format(new Date(subscription.started_at), "MMM dd, yyyy")}
              </span>
            </div>
            {subscription.expires_at && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Expires</span>
                  <span className="text-sm font-medium">
                    {format(new Date(subscription.expires_at), "MMM dd, yyyy")}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Days Remaining</span>
                  {(() => {
                    const daysLeft = Math.ceil(
                      (new Date(subscription.expires_at!).getTime() - new Date().getTime()) /
                      (1000 * 60 * 60 * 24)
                    );
                    const isExpiringSoon = daysLeft <= 7;
                    const isUrgent = daysLeft <= 3;
                    return (
                      <span className={`text-sm font-bold ${isUrgent ? 'text-destructive' : isExpiringSoon ? 'text-yellow-500' : 'text-green-500'}`}>
                        {daysLeft > 0 ? `${daysLeft} days` : 'Expired'}
                      </span>
                    );
                  })()}
                </div>

                {/* Visual Countdown */}
                {(() => {
                  const daysLeft = Math.ceil(
                    (new Date(subscription.expires_at!).getTime() - new Date().getTime()) /
                    (1000 * 60 * 60 * 24)
                  );
                  const maxDays = 365; // For yearly plans
                  const progress = Math.min(Math.max((daysLeft / maxDays) * 100, 0), 100);
                  const isExpiringSoon = daysLeft <= 7;
                  const isUrgent = daysLeft <= 3;

                  return (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Subscription Progress</span>
                        <span>{daysLeft > 0 ? `${daysLeft}d left` : 'Expired'}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isUrgent
                            ? 'bg-destructive'
                            : isExpiringSoon
                              ? 'bg-yellow-500'
                              : 'bg-gradient-to-r from-gold to-accent'
                            }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      {isExpiringSoon && daysLeft > 0 && (
                        <div className={`flex items-center gap-2 p-2 rounded-lg ${isUrgent ? 'bg-destructive/10 text-destructive' : 'bg-yellow-500/10 text-yellow-500'
                          }`}>
                          <Clock className="w-4 h-4" />
                          <span className="text-xs font-medium">
                            {isUrgent
                              ? `⚠️ Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}! Renew now to keep your benefits.`
                              : `Your subscription expires soon. Renew to continue your journey.`
                            }
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {(() => {
                  const daysLeft = Math.ceil(
                    (new Date(subscription.expires_at!).getTime() - new Date().getTime()) /
                    (1000 * 60 * 60 * 24)
                  );
                  if (daysLeft <= 7 && daysLeft > 0) {
                    return (
                      <Button
                        onClick={() => navigate('/premium')}
                        className="w-full mt-3 bg-gradient-to-r from-gold to-accent hover:from-gold/90 hover:to-accent/90"
                        size="sm"
                      >
                        <Crown className="w-4 h-4 mr-2" />
                        Renew Subscription
                      </Button>
                    );
                  }
                  return null;
                })()}
              </>
            )}
          </div>
        </Card>
      )}

      {/* Archetype Evolution */}
      <Card className="p-6 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Archetype Evolution
        </h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Current: {profile.archetype}</span>
              <span className="text-sm text-muted-foreground">{currentProgress}%</span>
            </div>
            <Progress value={currentProgress} className="h-3" />
            {nextArchetype && (
              <p className="text-sm text-muted-foreground mt-2">
                Next: {nextArchetype}
              </p>
            )}
          </div>
          <div className="pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">Brain Rot Score: {profile.brain_rot_score}/25</p>
            <p className="text-xs text-muted-foreground mt-1">
              Keep completing quests to evolve your archetype!
            </p>
          </div>
        </div>
      </Card>

      {/* Journey Stats */}
      <Card className="p-6 bg-card/50 border-primary/20">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-accent" />
          Your Journey
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Member Since</span>
            <span className="text-sm font-medium">
              {format(new Date(profile.created_at), "MMM dd, yyyy")}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total Days Active</span>
            <span className="text-sm font-medium">
              {Math.floor((new Date().getTime() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24))} days
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Average XP per Quest</span>
            <span className="text-sm font-medium">
              {profile.total_quests_completed > 0
                ? Math.round(profile.xp / profile.total_quests_completed)
                : 0} XP
            </span>
          </div>
        </div>
      </Card>

      {/* Avatar Customizer */}
      <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
        <AvatarCustomizer
          isPremium={profile.premium_status}
          onAvatarChange={fetchProfile}
        />
      </Card>

      {/* Theme Selector - Available to all, premium themes locked */}
      <ThemeSelector isPremium={profile.premium_status} />

      {/* Notification Settings */}
      <NotificationSettings />

      {/* Admin Dashboard - Only visible to admins */}
      {isAdmin && (
        <Card className="p-6 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/20">
          <Button
            onClick={() => navigate("/admin")}
            variant="outline"
            className="w-full border-purple-500/30 hover:bg-purple-500/10"
            size="lg"
          >
            <Shield className="w-5 h-5 mr-2" />
            Admin Dashboard
          </Button>
        </Card>
      )}

      {/* Payment History */}
      <Card className="p-6 bg-card/50 border-primary/20">
        <Button
          onClick={() => navigate("/payment-history")}
          variant="outline"
          className="w-full"
          size="lg"
        >
          <Receipt className="w-5 h-5 mr-2" />
          View Payment History
        </Button>
      </Card>

      {/* Logout Button */}
      <Card className="p-6 bg-card/50 border-primary/20">
        <Button
          onClick={handleSignOut}
          variant="destructive"
          className="w-full"
          size="lg"
        >
          <LogOut className="w-5 h-5 mr-2" />
          Sign Out
        </Button>
      </Card>
    </div>
  );
}
