import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings, X, Tag, Check, AlertCircle, ChevronDown, ChevronUp, Euro, Music, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AdminInstrumentals from "./AdminInstrumentals";
import AdminServicesPricing from "./AdminServicesPricing";
import AdminServiceFeatures from "./AdminServiceFeatures";
import AdminUserManagement from "./AdminUserManagement";
import AdminChatbotConfig from "./AdminChatbotConfig";
import AdminActivitySecurity from "./AdminActivitySecurity";
import AdminGallery from "./AdminGallery";

interface PromoCode {
  id: string;
  code: string;
  is_active: boolean;
  full_calendar_visibility: boolean;
  skip_payment: boolean;
  skip_identity_verification: boolean;
  skip_form_fields: boolean;
  auto_select_service: string | null;
  discount_recording: number;
  discount_rental: number;
  discount_mixing: number;
  discount_mastering: number;
}

interface AdminPanelProps {
  inline?: boolean;
}

const AdminPanel = ({ inline = false }: AdminPanelProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchPromoCodes();
  }, []);

  const fetchPromoCodes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("promo_codes")
        .select("*")
        .order("code");

      if (error) throw error;
      setPromoCodes(data || []);
    } catch (err) {
      console.error("Error fetching promo codes:", err);
      toast({
        title: "Erreur",
        description: "Impossible de charger les codes promo",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const togglePromoCode = async (id: string, currentState: boolean) => {
    setUpdating(id);
    try {
      const { error } = await supabase
        .from("promo_codes")
        .update({ is_active: !currentState })
        .eq("id", id);

      if (error) throw error;

      setPromoCodes(codes =>
        codes.map(c => (c.id === id ? { ...c, is_active: !currentState } : c))
      );

      toast({
        title: "Code promo mis à jour",
        description: `Code ${!currentState ? "activé" : "désactivé"} avec succès`,
      });
    } catch (err) {
      console.error("Error updating promo code:", err);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le code promo",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const getPromoDescription = (promo: PromoCode) => {
    const features: string[] = [];
    if (promo.skip_payment) features.push("Sans paiement");
    if (promo.skip_identity_verification) features.push("Sans vérification ID");
    if (promo.skip_form_fields) features.push("Formulaire simplifié");
    if (promo.full_calendar_visibility) features.push("Calendrier VIP");
    if (promo.discount_recording > 0) features.push(`-${promo.discount_recording}% recording`);
    if (promo.discount_rental > 0) features.push(`-${promo.discount_rental}% location`);
    if (promo.discount_mixing > 0) features.push(`-${promo.discount_mixing}% mixing`);
    if (promo.discount_mastering > 0) features.push(`-${promo.discount_mastering}% mastering`);
    return features.length > 0 ? features.join(" • ") : "Aucun effet";
  };

  // Inline mode - renders nothing (removed from admin banner)
  if (inline) {
    return null;
  }

  // Floating panel mode
  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 bg-primary/20 border-primary hover:bg-primary/30"
        title="Panneau Admin"
      >
        <Settings className="w-5 h-5 text-primary" />
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[80vh] bg-card border border-border rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/50">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Panneau Admin</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)] space-y-6">
          {/* Promo Codes Management */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Gestion des codes promo
            </h3>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Chargement...
              </div>
            ) : promoCodes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucun code promo configuré
              </div>
            ) : (
              <div className="space-y-3">
                {promoCodes.map(promo => (
                  <div
                    key={promo.id}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-lg border transition-colors",
                      promo.is_active
                        ? "bg-primary/5 border-primary/30"
                        : "bg-muted/30 border-border opacity-60"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-foreground">
                          {promo.code}
                        </span>
                        {promo.is_active ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {getPromoDescription(promo)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <Label
                        htmlFor={`promo-${promo.id}`}
                        className="text-xs text-muted-foreground cursor-pointer"
                      >
                        {promo.is_active ? "Actif" : "Inactif"}
                      </Label>
                      <Switch
                        id={`promo-${promo.id}`}
                        checked={promo.is_active}
                        onCheckedChange={() => togglePromoCode(promo.id, promo.is_active)}
                        disabled={updating === promo.id}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Instrumentals Management */}
          <AdminInstrumentals />

          {/* Services Pricing Management */}
          <AdminServicesPricing />

          {/* Service Features Management */}
          <AdminServiceFeatures />

          {/* User Management */}
          <AdminUserManagement />

          {/* Activity & Security */}
          <AdminActivitySecurity />

          {/* Gallery Management */}
          <AdminGallery />

          {/* Chatbot Configuration */}
          <AdminChatbotConfig />

          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Panneau réservé aux administrateurs
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
