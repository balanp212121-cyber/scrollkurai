import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

interface SignupFormProps {
  onToggleMode: () => void;
}

export const SignupForm = ({ onToggleMode }: SignupFormProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get("ref");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          username,
        },
      },
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    // If there's a referral code, create the referral record
    if (referralCode) {
      try {
        const { data: { user: newUser } } = await supabase.auth.getUser();
        
        if (newUser) {
          // Find the referrer by code
          const { data: referralData, error: referralError } = await supabase
            .from("referral_codes")
            .select("user_id")
            .eq("code", referralCode)
            .single();

          if (!referralError && referralData) {
            // Create the referral record
            await supabase.from("referrals").insert({
              referrer_id: referralData.user_id,
              referred_id: newUser.id,
              referral_code: referralCode,
              status: "pending",
            });
          }
        }
      } catch (error) {
        console.error("Error creating referral:", error);
      }
    }

    toast.success("Account created! Welcome to ScrollKurai!");
    setLoading(false);
  };

  return (
    <form onSubmit={handleSignup} className="space-y-4 w-full max-w-md">
      {referralCode && (
        <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <p className="text-sm text-center">
            🎉 You're joining with referral code: <span className="font-mono font-bold">{referralCode}</span>
          </p>
        </div>
      )}
      
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          type="text"
          placeholder="kurai_warrior"
          value={username}
          onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30))}
          maxLength={30}
          pattern="^[a-zA-Z0-9_]+$"
          title="Username can only contain letters, numbers, and underscores"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password">Password</Label>
        <Input
          id="signup-password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creating account..." : "Create Account"}
      </Button>
      <p className="text-sm text-center text-muted-foreground">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onToggleMode}
          className="text-primary hover:underline"
        >
          Sign in
        </button>
      </p>
    </form>
  );
};
