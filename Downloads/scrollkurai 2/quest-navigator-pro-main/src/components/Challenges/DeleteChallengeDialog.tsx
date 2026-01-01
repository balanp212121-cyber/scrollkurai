import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DeleteChallengeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challengeId: string | null;
  challengeTitle: string;
  onChallengeDeleted: () => void;
}

export function DeleteChallengeDialog({
  open,
  onOpenChange,
  challengeId,
  challengeTitle,
  onChallengeDeleted,
}: DeleteChallengeDialogProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!challengeId) return;

    setDeleting(true);
    try {
      // First delete all participants
      await supabase
        .from('challenge_participants')
        .delete()
        .eq('challenge_id', challengeId);

      // Then delete the challenge
      const { error } = await supabase
        .from('challenges')
        .delete()
        .eq('id', challengeId);

      if (error) throw error;

      toast.success("Challenge deleted successfully");
      onChallengeDeleted();
      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting challenge:', error);
      toast.error("Failed to delete challenge");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Challenge</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{challengeTitle}"? This will also remove all participants from this challenge. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? "Deleting..." : "Delete Challenge"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
