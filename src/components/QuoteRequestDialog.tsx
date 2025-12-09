import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Mail, MessageSquare, Loader2, Send, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuoteRequestDialogProps {
  trigger?: React.ReactNode;
}

type QuoteMode = "choose" | "email" | "chatbot";

const QuoteRequestDialog = ({ trigger }: QuoteRequestDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<QuoteMode>("choose");
  const [loading, setLoading] = useState(false);
  
  // Email form state
  const [emailForm, setEmailForm] = useState({
    name: "",
    email: "",
    phone: "",
    projectType: "",
    description: "",
  });

  // Chatbot state
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
    { 
      role: "assistant", 
      content: "Bonjour ! Je suis l'assistant Make Music. Je vais vous aider à établir un devis personnalisé pour votre projet. 🎵\n\nPour commencer, pouvez-vous me décrire votre projet ? (Type de session, nombre de morceaux, style musical, etc.)" 
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [quoteGenerated, setQuoteGenerated] = useState(false);

  const handleEmailSubmit = async () => {
    if (!emailForm.name || !emailForm.email || !emailForm.description) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.functions.invoke("send-quote-request", {
        body: {
          type: "email",
          name: emailForm.name,
          email: emailForm.email,
          phone: emailForm.phone,
          projectType: emailForm.projectType,
          description: emailForm.description,
        },
      });

      if (error) throw error;

      toast({
        title: "Demande envoyée !",
        description: "Nous vous répondrons dans les plus brefs délais.",
      });

      setOpen(false);
      resetForm();
    } catch (err) {
      console.error("Error sending quote request:", err);
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer votre demande. Réessayez.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setChatLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("quote-assistant", {
        body: {
          messages: [...chatMessages, { role: "user", content: userMessage }],
        },
      });

      if (error) throw error;

      const assistantMessage = data.message || "Désolé, je n'ai pas pu traiter votre demande.";
      setChatMessages(prev => [...prev, { role: "assistant", content: assistantMessage }]);

      // Check if quote was generated
      if (data.quoteGenerated) {
        setQuoteGenerated(true);
      }
    } catch (err) {
      console.error("Chat error:", err);
      setChatMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Désolé, une erreur est survenue. Veuillez réessayer ou utiliser le formulaire email." 
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const resetForm = () => {
    setMode("choose");
    setEmailForm({ name: "", email: "", phone: "", projectType: "", description: "" });
    setChatMessages([{ 
      role: "assistant", 
      content: "Bonjour ! Je suis l'assistant Make Music. Je vais vous aider à établir un devis personnalisé pour votre projet. 🎵\n\nPour commencer, pouvez-vous me décrire votre projet ? (Type de session, nombre de morceaux, style musical, etc.)" 
    }]);
    setChatInput("");
    setQuoteGenerated(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="lg">
            Demander un devis personnalisé
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className={cn(
        "bg-card border-border",
        mode === "chatbot" ? "sm:max-w-[600px]" : "sm:max-w-[500px]"
      )}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            {mode === "choose" && "Demander un devis"}
            {mode === "email" && <><Mail className="w-5 h-5 text-primary" /> Envoyer un email</>}
            {mode === "chatbot" && <><Bot className="w-5 h-5 text-primary" /> Assistant devis</>}
          </DialogTitle>
          <DialogDescription>
            {mode === "choose" && "Comment souhaitez-vous demander votre devis ?"}
            {mode === "email" && "Décrivez votre projet et nous vous répondrons rapidement."}
            {mode === "chatbot" && "Notre assistant IA vous aide à établir un devis personnalisé."}
          </DialogDescription>
        </DialogHeader>

        {/* Mode selection */}
        {mode === "choose" && (
          <div className="grid gap-4 py-4">
            <button
              onClick={() => setMode("email")}
              className="p-6 rounded-xl border-2 border-border bg-secondary/30 hover:border-primary/50 transition-all duration-300 text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                  <Mail className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h4 className="font-display text-lg text-foreground">Envoyer un email</h4>
                  <p className="text-sm text-muted-foreground">Décrivez votre projet, nous vous répondrons sous 24h</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setMode("chatbot")}
              className="p-6 rounded-xl border-2 border-border bg-secondary/30 hover:border-accent/50 transition-all duration-300 text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center group-hover:bg-accent/30 transition-colors">
                  <MessageSquare className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h4 className="font-display text-lg text-foreground">Assistant intelligent</h4>
                  <p className="text-sm text-muted-foreground">Notre chatbot vous aide à établir un devis instantané</p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Email form */}
        {mode === "email" && (
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quote-name">Nom complet *</Label>
                <Input
                  id="quote-name"
                  value={emailForm.name}
                  onChange={(e) => setEmailForm({ ...emailForm, name: e.target.value })}
                  placeholder="Votre nom"
                  className="bg-secondary/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quote-email">Email *</Label>
                <Input
                  id="quote-email"
                  type="email"
                  value={emailForm.email}
                  onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })}
                  placeholder="votre@email.com"
                  className="bg-secondary/50 border-border"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quote-phone">Téléphone</Label>
                <Input
                  id="quote-phone"
                  value={emailForm.phone}
                  onChange={(e) => setEmailForm({ ...emailForm, phone: e.target.value })}
                  placeholder="+32..."
                  className="bg-secondary/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quote-type">Type de projet</Label>
                <Input
                  id="quote-type"
                  value={emailForm.projectType}
                  onChange={(e) => setEmailForm({ ...emailForm, projectType: e.target.value })}
                  placeholder="Album, EP, Single..."
                  className="bg-secondary/50 border-border"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quote-description">Description du projet *</Label>
              <Textarea
                id="quote-description"
                value={emailForm.description}
                onChange={(e) => setEmailForm({ ...emailForm, description: e.target.value })}
                placeholder="Décrivez votre projet en détail : nombre de morceaux, style musical, besoins spécifiques..."
                className="bg-secondary/50 border-border min-h-[120px]"
              />
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setMode("choose")}>
                Retour
              </Button>
              <Button onClick={handleEmailSubmit} disabled={loading} variant="hero">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Envoi...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Envoyer
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Chatbot */}
        {mode === "chatbot" && (
          <div className="flex flex-col h-[400px]">
            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-2">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] p-3 rounded-xl text-sm whitespace-pre-wrap",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary/50 text-foreground border border-border"
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-secondary/50 border border-border p-3 rounded-xl">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  </div>
                </div>
              )}
            </div>

            {/* Chat input */}
            <div className="border-t border-border pt-4 mt-auto">
              {quoteGenerated ? (
                <div className="text-center space-y-3">
                  <p className="text-sm text-green-500">✅ Devis envoyé à l'équipe Make Music !</p>
                  <Button onClick={() => setOpen(false)} variant="hero" className="w-full">
                    Fermer
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !chatLoading && handleChatSubmit()}
                    placeholder="Écrivez votre message..."
                    className="flex-1 bg-secondary/50 border-border"
                    disabled={chatLoading}
                  />
                  <Button onClick={handleChatSubmit} disabled={chatLoading || !chatInput.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              )}
              <div className="flex justify-between mt-2">
                <Button variant="ghost" size="sm" onClick={() => setMode("choose")}>
                  ← Retour
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default QuoteRequestDialog;
