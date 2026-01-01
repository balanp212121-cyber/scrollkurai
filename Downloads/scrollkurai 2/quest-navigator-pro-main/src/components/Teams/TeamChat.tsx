import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Message {
    id: string;
    content: string;
    created_at: string;
    user_id: string;
    profiles: {
        username: string;
        avatar_url: string | null;
    };
}

interface TeamChatProps {
    teamId: string;
}

export function TeamChat({ teamId }: TeamChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Pagination state
    const MESSAGES_PER_PAGE = 50;
    const oldestMessageDateRef = useRef<string | null>(null);

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setCurrentUserId(user?.id || null);
        });

        // Initial fetch
        fetchMessages(true);

        // Subscribe to realtime messages
        const channel = supabase
            .channel(`team-chat-${teamId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'team_messages',
                    filter: `team_id=eq.${teamId}`
                },
                async (payload) => {
                    const { data, error } = await supabase
                        .from('team_messages')
                        .select(`
              *,
              profiles (
                username,
                avatar_url
              )
            `)
                        .eq('id', payload.new.id)
                        .single();

                    if (!error && data) {
                        setMessages((prev) => [...prev, data as any]);
                        scrollToBottom();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [teamId]);

    const fetchMessages = async (isInitial = false) => {
        try {
            if (isInitial) setLoading(true);
            else setLoadingMore(true);

            let query = supabase
                .from('team_messages')
                .select(`
          *,
          profiles (
            username,
            avatar_url
          )
        `)
                .eq('team_id', teamId)
                .order('created_at', { ascending: false }) // Fetch newest first
                .limit(MESSAGES_PER_PAGE);

            if (!isInitial && oldestMessageDateRef.current) {
                query = query.lt('created_at', oldestMessageDateRef.current);
            }

            const { data, error } = await query;

            if (error) throw error;

            const newMessages = (data as any || []).reverse(); // Reverse to show oldest -> newest

            if (newMessages.length < MESSAGES_PER_PAGE) {
                setHasMore(false);
            }

            if (newMessages.length > 0) {
                oldestMessageDateRef.current = newMessages[0].created_at; // Oldest is now first because of reverse()

                if (isInitial) {
                    setMessages(newMessages);
                    scrollToBottom();
                } else {
                    setMessages((prev) => [...newMessages, ...prev]);
                }
            } else if (isInitial) {
                setMessages([]);
                setHasMore(false);
            }

        } catch (error) {
            console.error('Error fetching messages:', error);
            toast.error('Failed to load chat history');
        } finally {
            if (isInitial) setLoading(false);
            else setLoadingMore(false);
        }
    };

    const handleLoadMore = () => {
        fetchMessages(false);
    };

    const scrollToBottom = () => {
        setTimeout(() => {
            if (scrollRef.current) {
                scrollRef.current.scrollIntoView({ behavior: 'smooth' });
            }
        }, 100);
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !currentUserId) return;

        const messageContent = newMessage.trim();
        setNewMessage("");

        try {
            const { error } = await supabase
                .from('team_messages')
                .insert({
                    team_id: teamId,
                    user_id: currentUserId,
                    content: messageContent,
                });

            if (error) throw error;
        } catch (error) {
            console.error('Error sending message:', error);
            toast.error('Failed to send message');
            setNewMessage(messageContent);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[500px] w-full max-w-md mx-auto bg-card rounded-lg border shadow-sm">
            <div className="p-4 border-b bg-muted/30">
                <h3 className="font-semibold">Team Chat</h3>
                <p className="text-xs text-muted-foreground">Coordinate with your squad</p>
            </div>

            <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                    {hasMore && (
                        <div className="flex justify-center pb-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleLoadMore}
                                disabled={loadingMore}
                            >
                                {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : "Load older messages"}
                            </Button>
                        </div>
                    )}

                    {messages.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                            <p>No messages yet.</p>
                            <p className="text-sm">Be the first to say hello! 👋</p>
                        </div>
                    ) : (
                        messages.map((message) => {
                            const isMe = message.user_id === currentUserId;
                            return (
                                <div
                                    key={message.id}
                                    className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                                >
                                    <Avatar className="w-8 h-8">
                                        <AvatarImage src={message.profiles?.avatar_url || ''} />
                                        <AvatarFallback>{message.profiles?.username?.charAt(0)?.toUpperCase() || '?'}</AvatarFallback>
                                    </Avatar>

                                    <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-medium text-muted-foreground">
                                                {isMe ? 'You' : message.profiles?.username}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground/70">
                                                {format(new Date(message.created_at), 'HH:mm')}
                                            </span>
                                        </div>
                                        <div
                                            className={`px-3 py-2 rounded-lg text-sm ${isMe
                                                ? 'bg-primary text-primary-foreground rounded-tr-none'
                                                : 'bg-muted text-foreground rounded-tl-none'
                                                }`}
                                        >
                                            {message.content}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={scrollRef} />
                </div>
            </ScrollArea>

            <div className="p-4 border-t bg-background">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                    <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1"
                    />
                    <Button type="submit" size="icon" disabled={!newMessage.trim()}>
                        <Send className="w-4 h-4" />
                    </Button>
                </form>
            </div>
        </div>
    );
}
