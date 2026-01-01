import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Video, Clock, CheckCircle, Play, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PremiumRouteGuard } from "@/components/Premium/PremiumRouteGuard";

interface Lesson {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  category: string;
  video_url: string | null;
  thumbnail_url: string | null;
  progress?: number;
  completed?: boolean;
  last_position_seconds?: number;
}

export default function CoursesPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);

  useEffect(() => {
    fetchLessons();
  }, []);

  const fetchLessons = async () => {
    try {
      const { data: lessonsData } = await supabase
        .from('premium_lessons')
        .select('*')
        .eq('is_published', true)
        .order('order_index');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !lessonsData) {
        setLessons([]);
        return;
      }

      const { data: progressData } = await supabase
        .from('lesson_progress')
        .select('*')
        .eq('user_id', user.id);

      const lessonsWithProgress = lessonsData.map(lesson => {
        const progress = progressData?.find(p => p.lesson_id === lesson.id);
        return {
          ...lesson,
          progress: progress?.progress_percent || 0,
          completed: progress?.completed || false,
          last_position_seconds: progress?.last_position_seconds || 0
        };
      });

      setLessons(lessonsWithProgress);
    } catch (error) {
      console.error('Error fetching lessons:', error);
      toast.error("Failed to load courses");
    } finally {
      setLoading(false);
    }
  };

  const startLesson = (lesson: Lesson) => {
    if (!lesson.video_url) {
      toast.info("Video coming soon!", {
        description: "This lesson's video is being prepared"
      });
      return;
    }
    setSelectedLesson(lesson);
    setVideoDialogOpen(true);
  };

  const updateProgress = async (lessonId: string, progressPercent: number, positionSeconds: number) => {
    try {
      // Use the RPC function for atomic update
      await supabase.rpc('update_lesson_progress', {
        p_lesson_id: lessonId,
        p_progress_percent: Math.round(progressPercent),
        p_position_seconds: Math.round(positionSeconds)
      });

      // Update local state
      setLessons(prev => prev.map(l =>
        l.id === lessonId
          ? {
            ...l,
            progress: Math.max(l.progress || 0, progressPercent),
            completed: progressPercent >= 90,
            last_position_seconds: positionSeconds
          }
          : l
      ));
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  const handleVideoProgress = (lesson: Lesson, currentTime: number, duration: number) => {
    if (duration > 0) {
      const progress = (currentTime / duration) * 100;
      updateProgress(lesson.id, progress, currentTime);
    }
  };

  const handleVideoEnded = (lesson: Lesson) => {
    updateProgress(lesson.id, 100, 0);
    toast.success("Lesson completed! 🎉", {
      description: `You've finished "${lesson.title}"`
    });
  };

  const completedCount = lessons.filter(l => l.completed).length;
  const overallProgress = lessons.length > 0 ? (completedCount / lessons.length) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
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
              Learn mindfulness and productivity
            </p>
          </div>
        </div>

        {/* Progress Overview */}
        <Card className="p-6 bg-gradient-to-r from-primary/20 to-accent/20 border-primary/30">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Progress</span>
              <span className="font-medium">
                {completedCount} / {lessons.length} completed
              </span>
            </div>
            <Progress value={overallProgress} />
          </div>
        </Card>

        {/* Lessons List */}
        <div className="grid gap-4">
          {lessons.map((lesson) => (
            <Card key={lesson.id} className="p-6 hover:border-primary/50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-4 flex-1">
                  {/* Thumbnail or Icon */}
                  <div className="relative w-24 h-16 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                    {lesson.thumbnail_url ? (
                      <img
                        src={lesson.thumbnail_url}
                        alt={lesson.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    {lesson.video_url && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Play className="w-6 h-6 text-white" />
                      </div>
                    )}
                    {lesson.completed && (
                      <div className="absolute top-1 right-1">
                        <CheckCircle className="w-4 h-4 text-green-500 bg-white rounded-full" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold">{lesson.title}</h3>
                      <Badge className="bg-accent/20 text-accent border-accent/30">
                        {lesson.category}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {lesson.description}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {lesson.duration_minutes} min
                      </span>
                      {lesson.progress > 0 && !lesson.completed && (
                        <span className="text-primary">
                          {Math.round(lesson.progress)}% watched
                        </span>
                      )}
                    </div>
                    {lesson.progress > 0 && !lesson.completed && (
                      <Progress value={lesson.progress} className="h-1" />
                    )}
                  </div>
                </div>

                <Button
                  onClick={() => startLesson(lesson)}
                  variant={lesson.completed ? "outline" : "default"}
                  disabled={!lesson.video_url}
                >
                  {!lesson.video_url ? "Coming Soon" :
                    lesson.completed ? "Rewatch" :
                      lesson.progress > 0 ? "Continue" : "Start"}
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {lessons.length === 0 && (
          <Card className="p-8 text-center">
            <Video className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No courses available yet. Check back soon!
            </p>
          </Card>
        )}

        {/* Video Player Dialog */}
        <Dialog open={videoDialogOpen} onOpenChange={setVideoDialogOpen}>
          <DialogContent className="max-w-4xl p-0">
            <DialogHeader className="p-4 pb-0">
              <div className="flex items-center justify-between">
                <DialogTitle>{selectedLesson?.title}</DialogTitle>
              </div>
            </DialogHeader>

            {selectedLesson?.video_url && (
              <div className="aspect-video bg-black">
                <video
                  src={selectedLesson.video_url}
                  controls
                  autoPlay
                  className="w-full h-full"
                  onTimeUpdate={(e) => {
                    const video = e.currentTarget;
                    handleVideoProgress(selectedLesson, video.currentTime, video.duration);
                  }}
                  onEnded={() => handleVideoEnded(selectedLesson)}
                  // Resume from last position
                  onLoadedMetadata={(e) => {
                    const video = e.currentTarget;
                    if (selectedLesson.last_position_seconds && selectedLesson.last_position_seconds > 0) {
                      video.currentTime = selectedLesson.last_position_seconds;
                    }
                  }}
                >
                  Your browser does not support video playback.
                </video>
              </div>
            )}

            <div className="p-4 pt-2">
              <p className="text-sm text-muted-foreground">
                {selectedLesson?.description}
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PremiumRouteGuard>
  );
}