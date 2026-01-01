import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Ensures that the logged-in user has a profile in the database.
 * If not, creates one automatically as a fallback.
 */
export const useEnsureUserProfile = () => {
  const { toast } = useToast();

  useEffect(() => {
    const ensureProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Check if profile exists
        const { data: profile, error: fetchError } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();

        if (fetchError) {
          console.error("Error checking profile:", fetchError);
          return;
        }

        // If profile doesn't exist, create it
        if (!profile) {
          console.log("Profile not found, creating fallback profile for user:", user.id);
          
          const username = user.user_metadata?.username || user.email?.split('@')[0] || 'Warrior';
          
          const { error: insertError } = await supabase
            .from("profiles")
            .insert({
              id: user.id,
              username: username,
              archetype: 'Certified Brain Rotter',
              xp: 0,
              level: 1,
              streak: 0,
              total_quests_completed: 0,
              brain_rot_score: 0,
              quiz_completed: false,
              premium_status: false
            });

          if (insertError) {
            console.error("Error creating profile:", insertError);
            toast({
              title: "Profile Creation Failed",
              description: "There was an issue creating your profile. Please refresh the page.",
              variant: "destructive"
            });
          } else {
            console.log("Profile created successfully");
            toast({
              title: "Welcome!",
              description: "Your profile has been set up successfully.",
            });
          }
        }
      } catch (error) {
        console.error("Error in ensureProfile:", error);
      }
    };

    ensureProfile();
  }, [toast]);
};