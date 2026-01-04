import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Video, GraduationCap, Briefcase, Clock, CheckCircle, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PremiumRouteGuard } from "@/components/Premium/PremiumRouteGuard";

type UserStatus = "school" | "college" | "unemployed" | "employed";

const learningTopics = [
  { id: "productivity", label: "Productivity & Time Management" },
  { id: "mindfulness", label: "Mindfulness & Mental Wellness" },
  { id: "digital_detox", label: "Digital Detox & Focus" },
  { id: "study_habits", label: "Study Habits & Learning" },
  { id: "career", label: "Career Development" },
  { id: "communication", label: "Communication Skills" },
  { id: "stress", label: "Stress Management" },
  { id: "sleep", label: "Sleep & Rest Optimization" },
];

export default function CoursesPage() {
  const [userStatus, setUserStatus] = useState<UserStatus | "">("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleTopicToggle = (topicId: string) => {
    setSelectedTopics(prev =>
      prev.includes(topicId)
        ? prev.filter(t => t !== topicId)
        : [...prev, topicId]
    );
  };

  const handleSubmit = async () => {
    if (!userStatus) {
      toast.error("Please select your current status");
      return;
    }
    if (selectedTopics.length === 0) {
      toast.error("Please select at least one topic you want to learn");
      return;
    }

    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Save the course request
      const { error } = await supabase.from("course_requests").insert({
        user_id: user.id,
        user_status: userStatus,
        topics: selectedTopics,
        additional_info: additionalInfo || null,
        status: "pending"
      });

      if (error) throw error;

      setSubmitted(true);
      toast.success("Request Submitted! 🎉", {
        description: "We'll send your personalized course details within 48 hours",
        duration: 5000
      });
    } catch (error: any) {
      console.error("Error submitting course request:", error);
      toast.error("Failed to submit request", {
        description: error.message || "Please try again"
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <PremiumRouteGuard>
        <div className="pb-20 space-y-6">
          <Card className="p-8 text-center bg-gradient-to-br from-primary/20 to-accent/20 border-primary/30">
            <CheckCircle className="w-16 h-16 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Request Submitted!</h2>
            <p className="text-muted-foreground mb-4">
              Thank you for sharing your preferences. Our team will curate personalized
              course recommendations based on your profile.
            </p>
            <Badge className="bg-accent/20 text-accent border-accent/30 text-lg px-4 py-2">
              <Clock className="w-4 h-4 mr-2" />
              Response within 48 hours
            </Badge>
          </Card>
        </div>
      </PremiumRouteGuard>
    );
  }

  return (
    <PremiumRouteGuard>
      <div className="pb-20 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Video className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Video Courses</h1>
            <p className="text-sm text-muted-foreground">
              Get personalized learning recommendations
            </p>
          </div>
        </div>

        {/* Info Card */}
        <Card className="p-6 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/30">
          <div className="flex items-start gap-4">
            <GraduationCap className="w-10 h-10 text-primary flex-shrink-0" />
            <div>
              <h3 className="font-bold text-lg mb-1">Personalized Course Curation</h3>
              <p className="text-sm text-muted-foreground">
                Tell us about yourself and what you want to learn. Our team will review
                your preferences and send curated video course recommendations tailored
                to your needs <strong>within 48 hours</strong>.
              </p>
            </div>
          </div>
        </Card>

        {/* Form */}
        <Card className="p-6 space-y-6">
          {/* User Status */}
          <div className="space-y-3">
            <Label className="text-lg font-semibold flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-accent" />
              What's your current status?
            </Label>
            <RadioGroup
              value={userStatus}
              onValueChange={(value) => setUserStatus(value as UserStatus)}
              className="grid grid-cols-2 gap-3"
            >
              <div className="flex items-center space-x-2 p-4 border rounded-lg hover:border-primary/50 cursor-pointer">
                <RadioGroupItem value="school" id="school" />
                <Label htmlFor="school" className="cursor-pointer">🎒 School Student</Label>
              </div>
              <div className="flex items-center space-x-2 p-4 border rounded-lg hover:border-primary/50 cursor-pointer">
                <RadioGroupItem value="college" id="college" />
                <Label htmlFor="college" className="cursor-pointer">🎓 College Student</Label>
              </div>
              <div className="flex items-center space-x-2 p-4 border rounded-lg hover:border-primary/50 cursor-pointer">
                <RadioGroupItem value="unemployed" id="unemployed" />
                <Label htmlFor="unemployed" className="cursor-pointer">🔍 Job Seeker</Label>
              </div>
              <div className="flex items-center space-x-2 p-4 border rounded-lg hover:border-primary/50 cursor-pointer">
                <RadioGroupItem value="employed" id="employed" />
                <Label htmlFor="employed" className="cursor-pointer">💼 Employed</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Learning Topics */}
          <div className="space-y-3">
            <Label className="text-lg font-semibold flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              What do you want to learn? (Select all that apply)
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {learningTopics.map((topic) => (
                <div
                  key={topic.id}
                  className={`flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-all ${selectedTopics.includes(topic.id)
                      ? "border-primary bg-primary/10"
                      : "hover:border-primary/50"
                    }`}
                  onClick={() => handleTopicToggle(topic.id)}
                >
                  <Checkbox
                    id={topic.id}
                    checked={selectedTopics.includes(topic.id)}
                    onCheckedChange={() => handleTopicToggle(topic.id)}
                  />
                  <Label htmlFor={topic.id} className="cursor-pointer flex-1">
                    {topic.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Additional Info */}
          <div className="space-y-3">
            <Label className="text-lg font-semibold">
              Anything else you'd like us to know? (Optional)
            </Label>
            <Textarea
              placeholder="E.g., I'm preparing for exams and need help staying focused..."
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={submitting || !userStatus || selectedTopics.length === 0}
            className="w-full"
            size="lg"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Submit Request
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            📧 You'll receive personalized course recommendations via email and in-app notification within 48 hours.
          </p>
        </Card>
      </div>
    </PremiumRouteGuard>
  );
}