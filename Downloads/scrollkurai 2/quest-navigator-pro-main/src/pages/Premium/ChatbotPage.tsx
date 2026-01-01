import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Brain, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PremiumRouteGuard } from "@/components/Premium/PremiumRouteGuard";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `You are a supportive AI wellness coach specializing in digital wellness, reducing screen time, and building better habits. Your role is to:

1. Help users recognize unhealthy digital habits and patterns
2. Provide practical, actionable strategies to reduce screen time
3. Offer motivation and emotional support during their journey
4. Guide users through reflection exercises
5. Celebrate progress and help users stay accountable

Guidelines:
- Be warm, empathetic, and encouraging
- Keep responses concise but helpful (2-4 sentences typically)
- Ask thoughtful follow-up questions to understand user's situation
- Provide specific, personalized advice when possible
- Reference evidence-based strategies for habit change
- Never be judgmental about screen time struggles
- Focus on progress over perfection`;

export default function ChatbotPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm your AI wellness coach. I can help you reduce screen time and build better habits. What would you like to discuss today?"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    
    const newMessages: Message[] = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    try {
      // Build conversation history for context
      const conversationHistory = newMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const { data, error } = await supabase.functions.invoke('ai-coaching-chat', {
        body: { 
          messages: conversationHistory,
          systemPrompt: SYSTEM_PROMPT
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to get AI response');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const assistantResponse = data?.response || "I'm here to help you on your wellness journey. Could you tell me more about what you're working on?";
      
      setMessages(prev => [...prev, { role: "assistant", content: assistantResponse }]);
    } catch (error: unknown) {
      console.error('AI coaching error:', error);
      
      // Friendly fallback message
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "I'm having a moment of reflection myself! Let me try again. In the meantime, remember: every step toward better habits counts, no matter how small. What's on your mind?" 
      }]);
      
      toast.error("Connection hiccup - using fallback response");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PremiumRouteGuard>
      <div className="pb-20 space-y-6 flex flex-col h-[calc(100vh-8rem)]">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Brain className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">AI Wellness Coach</h1>
            <p className="text-sm text-muted-foreground">
              Powered by Gemini AI • Your personal guide to better habits
            </p>
          </div>
        </div>

        {/* Messages */}
        <Card className="flex-1 p-6 overflow-y-auto space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] p-4 rounded-lg ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] p-4 rounded-lg bg-muted flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Thinking...</p>
              </div>
            </div>
          )}
        </Card>

        {/* Input */}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && !loading && sendMessage()}
            placeholder="Ask me anything about reducing screen time..."
            disabled={loading}
          />
          <Button onClick={sendMessage} disabled={loading || !input.trim()}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </PremiumRouteGuard>
  );
}
