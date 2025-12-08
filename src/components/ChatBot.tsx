import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, X, Send, Mic, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: number;
  text: string;
  isBot: boolean;
}

const initialMessages: Message[] = [
  {
    id: 1,
    text: "Salut ! 👋 Je suis l'assistant du studio. Je connais tout notre équipement (le Neumann U87, la chaîne SSL, les Genelec...) et nos tarifs. Comment puis-je t'aider pour ton projet ?",
    isBot: true,
  },
];

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now(),
      text: input,
      isBot: false,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    // Simulate bot response (will be replaced with Gemini API)
    setTimeout(() => {
      const botResponse: Message = {
        id: Date.now() + 1,
        text: getBotResponse(input),
        isBot: true,
      };
      setMessages((prev) => [...prev, botResponse]);
      setIsTyping(false);
    }, 1500);
  };

  const getBotResponse = (userInput: string): string => {
    const input = userInput.toLowerCase();
    
    if (input.includes("prix") || input.includes("tarif") || input.includes("coût") || input.includes("combien")) {
      return "Nos tarifs sont très compétitifs ! 🎯\n\n• Session AVEC ingénieur : 45€/h\n• Location sèche (sans ingé) : 22€/h\n• Mixage complet : 200€\n• Mastering : 60€/titre\n\nQuel type de session t'intéresse ?";
    }
    
    if (input.includes("micro") || input.includes("neumann") || input.includes("matos") || input.includes("équipement")) {
      return "On a du matos de dingue ! 🎤\n\n• Micro Neumann U87 - LA référence mondiale\n• Chaîne SSL (préamp + EQ + compresseur)\n• Écoutes Genelec 8340A avec sub\n• ProTools avec plugins UAD, Waves, Auto-Tune...\n\nC'est l'équipement qu'on retrouve dans les plus grands studios !";
    }
    
    if (input.includes("réserver") || input.includes("dispo") || input.includes("créneau")) {
      return "Pour réserver, tu peux descendre sur notre formulaire de réservation en bas de page. Dis-moi d'abord quel type de projet tu as ? (enregistrement voix, instrus, podcast...) Je pourrai te conseiller la bonne formule ! 🎧";
    }
    
    if (input.includes("voix") || input.includes("rap") || input.includes("chant") || input.includes("vocal")) {
      return "Pour les voix, tu seras au top chez nous ! 🔥\n\nLe Neumann U87 combiné à la chaîne SSL, c'est le combo légendaire pour des voix cristallines. Avec notre traitement acoustique, t'auras un son ultra propre.\n\nJe te conseille la session avec ingénieur (45€/h) pour un premier enregistrement, il saura te guider pour le meilleur rendu !";
    }
    
    return "Je suis là pour t'aider ! 🎵\n\nTu peux me poser des questions sur :\n• Nos tarifs et formules\n• Le matériel du studio\n• Comment réserver\n• Quel setup pour ton projet\n\nQu'est-ce qui t'intéresse ?";
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
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
          
          {isTyping && (
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
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border bg-secondary/30">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Pose ta question..."
              className="bg-background border-border"
            />
            <Button onClick={handleSend} size="icon" variant="default">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ChatBot;
