import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Save, Loader2, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_PROMPT = `Tu es l'assistant virtuel de Make Music Studio, un studio d'enregistrement haut de gamme situé à Bruxelles (Rue du Sceptre 22, 1050 Ixelles). 

## Équipement du studio:
- Microphone: Neumann U87
- Préampli SSL
- Interface SSL
- Monitoring: Genelec avec subwoofer
- DAW: ProTools
- Plugins: UAD, Waves, Soundtoys, Antares (Auto-Tune), SSL, Slate Digital

## Services et tarifs:
- Session avec ingénieur son: 45€/h (acompte 50%)
- Location sèche (sans ingénieur): 22€/h (paiement complet)
- Mixage: 200€/projet (acompte 50%)
- Mastering numérique: 60€ (acompte 50%)
- Mastering analogique: 100€/piste (paiement complet)
- Mixage podcast: 40€/minute audio

## Ta mission:
- Répondre aux questions sur le studio et ses services
- Qualifier les projets des clients
- Conseiller sur le choix de prestation adapté
- Rediriger vers la réservation quand approprié

Sois professionnel, chaleureux et expert. Tu représentes un studio haut de gamme.`;

const AdminChatbotConfig = () => {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [originalPrompt, setOriginalPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("chatbot_config")
        .select("id, system_prompt")
        .limit(1)
        .single();
      
      if (error && error.code !== "PGRST116") throw error;
      
      if (data) {
        setPrompt(data.system_prompt);
        setOriginalPrompt(data.system_prompt);
        setConfigId(data.id);
      } else {
        setPrompt(DEFAULT_PROMPT);
        setOriginalPrompt(DEFAULT_PROMPT);
      }
    } catch (err) {
      console.error("Error fetching chatbot config:", err);
      setPrompt(DEFAULT_PROMPT);
      setOriginalPrompt(DEFAULT_PROMPT);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded) {
      fetchConfig();
    }
  }, [expanded]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (configId) {
        const { error } = await supabase
          .from("chatbot_config")
          .update({ 
            system_prompt: prompt,
            updated_at: new Date().toISOString()
          })
          .eq("id", configId);
        
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("chatbot_config")
          .insert({ system_prompt: prompt })
          .select("id")
          .single();
        
        if (error) throw error;
        setConfigId(data.id);
      }
      
      setOriginalPrompt(prompt);
      toast({
        title: "Configuration sauvegardée !",
        description: "Le prompt du chatbot a été mis à jour.",
      });
    } catch (err) {
      console.error("Error saving chatbot config:", err);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder la configuration",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPrompt(DEFAULT_PROMPT);
  };

  const hasChanges = prompt !== originalPrompt;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between bg-card hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-primary" />
          <span className="font-display text-lg text-foreground">CONFIGURATION CHATBOT IA</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>
      
      {expanded && (
        <div className="p-4 border-t border-border space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Prompt système du chatbot
                </label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[300px] font-mono text-sm"
                  placeholder="Entrez le prompt système pour le chatbot..."
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Ce prompt définit la personnalité et les connaissances du chatbot. Les modifications prennent effet immédiatement.
                </p>
              </div>

              <div className="flex items-center gap-2 justify-between">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="text-muted-foreground"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Réinitialiser
                </Button>
                
                <Button
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                  className={cn(hasChanges && "bg-green-600 hover:bg-green-700")}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {hasChanges ? "Sauvegarder les modifications" : "Aucune modification"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminChatbotConfig;
