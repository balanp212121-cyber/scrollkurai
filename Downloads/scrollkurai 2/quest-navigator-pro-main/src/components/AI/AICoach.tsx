import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, User, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export function AICoach() {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: "Hi! I'm your ScrollKurai AI Coach. I can help you break down big quests into small steps or reflect on your progress. What's on your mind?" }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const sendMessage = async () => {
        if (!input.trim() || loading) return;

        const userMessage = input.trim();
        setInput("");
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setLoading(true);

        try {
            const { data, error } = await supabase.functions.invoke('ai-coaching-chat', {
                body: {
                    messages: [...messages, { role: 'user', content: userMessage }],
                    systemPrompt: "You are a supportive productivity coach. Help the user achieve their goals by breaking them down into small, non-intimidating steps. Use gamification terms (XP, Quests) where appropriate."
                }
            });

            if (error) throw error;

            if (data?.response) {
                setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
            }
        } catch (e) {
            console.error("AI Error:", e);
            toast.error("Coach is offline. Try again later.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="h-[600px] flex flex-col border-primary/20 bg-gradient-to-br from-card to-primary/5">
            <CardHeader className="border-b border-border/50 bg-muted/20">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Bot className="w-6 h-6 text-primary" />
                    AI Coach
                    <span className="ml-auto text-xs font-normal text-muted-foreground bg-primary/10 px-2 py-1 rounded-full">
                        Powered by Gemini 2.0
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
                <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                                    }`}>
                                    {msg.role === 'user' ? <User className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                                </div>
                                <div className={`rounded-lg p-3 max-w-[80%] text-sm ${msg.role === 'user'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted/50 border border-border'
                                    }`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                </div>
                                <div className="text-sm text-muted-foreground self-center">Thinking...</div>
                            </div>
                        )}
                        <div ref={scrollRef} />
                    </div>
                </ScrollArea>
                <div className="p-4 border-t border-border/50 bg-background/50 backdrop-blur-sm">
                    <form
                        onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                        className="flex gap-2"
                    >
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ex: How do I start running 5k?"
                            disabled={loading}
                            className="bg-background"
                        />
                        <Button type="submit" disabled={loading || !input.trim()} size="icon">
                            <Send className="w-4 h-4" />
                        </Button>
                    </form>
                </div>
            </CardContent>
        </Card>
    );
}
