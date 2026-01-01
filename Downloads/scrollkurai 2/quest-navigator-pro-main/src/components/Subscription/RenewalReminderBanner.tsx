import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, X, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscriptionReminder } from "@/hooks/useSubscriptionReminder";
import { motion, AnimatePresence } from "framer-motion";

export function RenewalReminderBanner() {
  const { isExpiring, daysRemaining, expiresAt, loading } = useSubscriptionReminder();
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  if (loading || !isExpiring || dismissed) {
    return null;
  }

  const urgency = daysRemaining && daysRemaining <= 3 ? "high" : "medium";
  const formattedDate = expiresAt?.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`mx-4 mb-4 rounded-lg border p-3 ${
          urgency === "high"
            ? "bg-destructive/10 border-destructive/30"
            : "bg-amber-500/10 border-amber-500/30"
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded-full ${
              urgency === "high" ? "bg-destructive/20" : "bg-amber-500/20"
            }`}
          >
            {urgency === "high" ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : (
              <Crown className="h-4 w-4 text-amber-500" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {urgency === "high"
                ? `Premium expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}!`
                : `Premium expires on ${formattedDate}`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Renew to keep your themes, badges & power-ups
            </p>

            <Button
              size="sm"
              variant={urgency === "high" ? "destructive" : "default"}
              className="mt-2 h-7 text-xs"
              onClick={() => navigate("/premium")}
            >
              Renew Now
            </Button>
          </div>

          <button
            onClick={() => setDismissed(true)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
