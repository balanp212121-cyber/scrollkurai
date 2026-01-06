import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Heart, MessageCircle, Send, Sparkles, User } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Post {
  id: string;
  content: string;
  quest_content: string | null;
  likes_count: number;
  created_at: string;
  is_liked?: boolean;
}

export default function CommunityPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState("");
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPosts();

    // Set up realtime subscription for new posts
    const channel = supabase
      .channel('community-posts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'community_posts'
        },
        () => {
          fetchPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPosts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Use the secure view that masks user_id for anonymous posts
      const { data: postsData, error } = await (supabase as any)
        .from('public_community_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Check which posts the user has liked
      if (user) {
        const { data: likesData } = await (supabase as any)
          .from('post_likes')
          .select('post_id')
          .eq('user_id', user.id);

        const likedPostIds = new Set(likesData?.map((l: any) => l.post_id) || []);

        setPosts(postsData.map((post: Post) => ({
          ...post,
          is_liked: likedPostIds.has(post.id),
        })));
      } else {
        setPosts(postsData);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast.error('Failed to load community posts');
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async () => {
    const trimmedPost = newPost.trim();
    if (trimmedPost.length < 10) {
      toast.error('Post must be at least 10 characters');
      return;
    }
    if (trimmedPost.length > 500) {
      toast.error('Post cannot exceed 500 characters');
      return;
    }

    setPosting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please sign in to post');
        return;
      }

      const { error } = await (supabase as any)
        .from('community_posts')
        .insert({
          user_id: user.id,
          content: newPost,
          is_anonymous: true,
        });

      if (error) throw error;

      toast.success('Posted to community!');
      setNewPost('');
      fetchPosts();
    } catch (error) {
      console.error('Error posting:', error);
      toast.error('Failed to post');
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (postId: string, isLiked: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please sign in to like posts');
        return;
      }

      if (isLiked) {
        // Unlike: Remove like and decrement count
        const { error: deleteError } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        if (deleteError) throw deleteError;

        // Use the secure function to decrement likes
        const { error: rpcError } = await supabase.rpc('decrement_likes', {
          post_id: postId
        });

        if (rpcError) throw rpcError;
      } else {
        // Like: Add like and increment count
        const { error: insertError } = await supabase
          .from('post_likes')
          .insert({
            post_id: postId,
            user_id: user.id,
          });

        if (insertError) throw insertError;

        // Use the secure function to increment likes
        const { error: rpcError } = await supabase.rpc('increment_likes', {
          post_id: postId
        });

        if (rpcError) throw rpcError;
      }

      // Refresh posts to show updated counts
      fetchPosts();
    } catch (error: any) {
      console.error('Error liking post:', error);
      if (error.code === '23505') {
        toast.error('You already liked this post');
      } else {
        toast.error('Failed to update like');
      }
    }
  };

  return (
    <div className="pb-20 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Sparkles className="w-8 h-8 text-accent" />
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Community Feed
          </h1>
          <p className="text-sm text-muted-foreground">Share your journey anonymously</p>
        </div>
      </div>

      {/* Create Post */}
      <Card className="p-4 bg-gradient-to-br from-card to-card/50 border-primary/20">
        <div className="space-y-3">
          <Textarea
            placeholder="Share your reflection or achievement..."
            value={newPost}
            onChange={(e) => setNewPost(e.target.value.slice(0, 500))}
            className="min-h-[100px] resize-none"
            maxLength={500}
          />
          <div className="flex justify-between items-center">
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>Posts are anonymous • Minimum 10 characters • Maximum 500</p>
              <p className={newPost.trim().length < 10 ? 'text-yellow-500' : 'text-green-500'}>
                {newPost.trim().length} / 500 chars
              </p>
            </div>
            <Button
              onClick={handlePost}
              disabled={posting || newPost.trim().length < 10 || newPost.trim().length > 500}
              size="sm"
              className="bg-gradient-to-r from-primary to-accent"
            >
              <Send className="w-4 h-4 mr-2" />
              {posting ? 'Posting...' : 'Post'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Posts Feed */}
      <div className="space-y-4">
        {loading ? (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">Loading posts...</p>
          </Card>
        ) : posts.length === 0 ? (
          <Card className="p-6 text-center">
            <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No posts yet. Be the first to share!</p>
          </Card>
        ) : (
          posts.map((post) => (
            <Card key={post.id} className="p-4 bg-card/50 border-primary/20">
              <div className="space-y-3">
                {/* Anonymous Avatar Header */}
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-muted text-muted-foreground">
                      <User className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground">Anonymous User</span>
                </div>

                {post.quest_content && (
                  <div className="p-2 bg-primary/10 rounded-md border border-primary/20">
                    <p className="text-xs text-primary font-medium">
                      Quest: {post.quest_content}
                    </p>
                  </div>
                )}
                <p className="text-sm leading-relaxed">{post.content}</p>
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <button
                    onClick={() => handleLike(post.id, post.is_liked || false)}
                    className="flex items-center gap-2 text-sm transition-colors hover:text-accent"
                  >
                    <Heart
                      className={`w-4 h-4 ${post.is_liked ? 'fill-accent text-accent' : ''}`}
                    />
                    <span>{post.likes_count}</span>
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
