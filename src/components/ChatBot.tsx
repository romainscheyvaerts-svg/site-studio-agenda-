import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, X, Send, Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { DEFAULT_CHATBOT_GREETING } from "@/config/constants";

interface Message {
  id: number;
  text: string;
  isBot: boolean;
}

const initialMessages: Message[] = [
  {
    id: 1,
    text: DEFAULT_CHATBOT_GREETING,
    isBot: true,
  },
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/studio-chat`;

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now(),
      text: input,
      isBot: false,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      // Build conversation history for context
      const conversationHistory = messages
        .filter((m) => m.id !== 1) // Exclude initial greeting
        .map((m) => ({
          role: m.isBot ? "assistant" : "user",
          content: m.text,
        }));

      // Add current user message
      conversationHistory.push({ role: "user", content: input });

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: conversationHistory }),
      });

      if (!response.ok) {
        throw new Error("Erreur de connexion");
      }

      if (!response.body) {
        throw new Error("Pas de réponse");
      }

      // Stream the response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantContent = "";
      let assistantMessageId = Date.now() + 1;

      // Add empty assistant message
      setMessages((prev) => [
        ...prev,
        { id: assistantMessageId, text: "", isBot: true },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, text: assistantContent }
                    : m
                )
              );
            }
          } catch {
            // Incomplete JSON, wait for more data
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, text: assistantContent }
                    : m
                )
              );
            }
          } catch {
            /* ignore */
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Impossible de se connecter à l'assistant");
      
      // Fallback message
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: "Désolé, je rencontre un problème technique. Tu peux me reposer ta question ou consulter nos tarifs sur la page ! 🎧",
          isBot: true,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Chat button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110",
          "hover:shadow-[0_0_40px_hsl(var(--neon-cyan)/0.6)]",
          isOpen && "scale-0 opacity-0"
        )}
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {/* Chat window */}
      <div
        className={cn(
          "fixed bottom-6 right-6 z-50 w-[380px] max-h-[600px] rounded-2xl bg-card border border-border shadow-2xl transition-all duration-300 overflow-hidden flex flex-col",
          isOpen ? "scale-100 opacity-100" : "scale-90 opacity-0 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-border bg-secondary/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground">Assistant Studio</h4>
              <p className="text-xs text-primary flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Expert Audio IA
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[400px]">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.isBot ? "justify-start" : "justify-end"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] p-3 rounded-2xl text-sm whitespace-pre-line",
                  message.isBot
                    ? "bg-secondary/80 text-foreground rounded-tl-sm"
                    : "bg-primary text-primary-foreground rounded-tr-sm"
                )}
              >
                {message.text}
              </div>
            </div>
          ))}

          {isTyping && messages[messages.length - 1]?.text === "" && (
            <div className="flex justify-start">
              <div className="bg-secondary/80 p-3 rounded-2xl rounded-tl-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Send to booking button */}
        {messages.length > 2 && (
          <div className="px-4 py-2 border-t border-border bg-accent/10">
            <Button
              onClick={() => {
                // Create summary from conversation
                const conversationSummary = messages
                  .filter((m) => m.id !== 1)
                  .map((m) => `${m.isBot ? "Assistant" : "Client"}: ${m.text}`)
                  .join("\n\n");
                
                // Dispatch custom event with summary
                window.dispatchEvent(
                  new CustomEvent("chatbot-summary", { detail: conversationSummary })
                );
                
                // Scroll to booking section
                document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" });
                setIsOpen(false);
                toast.success("Résumé envoyé au formulaire !");
              }}
              variant="outline"
              size="sm"
              className="w-full border-accent text-accent hover:bg-accent/20"
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              Envoyer vers la réservation
            </Button>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-border bg-secondary/30">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Pose ta question..."
              className="bg-background border-border"
              disabled={isTyping}
            />
            <Button onClick={handleSend} size="icon" variant="default" disabled={isTyping}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ChatBot;
