import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tag,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Settings2,
  Percent,
  Eye,
  CreditCard,
  Shield,
  FileText,
  Calendar,
  Euro,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PromoCodeUsage {
  id: string;
  promo_code_id: string;
  user_email: string;
  used_at: string;
}

interface PromoCode {
  id: string;
  code: string;
  is_active: boolean;
  full_calendar_visibility: boolean;
  skip_payment: boolean;
  skip_identity_verification: boolean;
  skip_form_fields: boolean;
  auto_select_service: string | null;
  discount_recording: number | null;
  discount_rental: number | null;
  discount_mixing: number | null;
  discount_mastering: number | null;
  custom_price_with_engineer: number | null;
  custom_price_without_engineer: number | null;
  require_full_payment: boolean | null;
  max_uses_per_user: number | null;
  usage_count?: number;
}

const DEFAULT_PROMO: Omit<PromoCode, "id"> = {
  code: "",
  is_active: true,
  full_calendar_visibility: false,
  skip_payment: false,
  skip_identity_verification: false,
  skip_form_fields: false,
  auto_select_service: null,
  discount_recording: 0,
  discount_rental: 0,
  discount_mixing: 0,
  discount_mastering: 0,
  custom_price_with_engineer: null,
  custom_price_without_engineer: null,
  require_full_payment: false,
  max_uses_per_user: null,
};

const SERVICE_OPTIONS = [
  { value: "", label: "Aucun (choix libre)" },
  { value: "with-engineer", label: "Session avec ingénieur" },
  { value: "without-engineer", label: "Location sans ingénieur" },
  { value: "mixing", label: "Mixage" },
  { value: "mastering", label: "Mastering" },
  { value: "analog-mastering", label: "Mastering Analogique" },
  { value: "podcast", label: "Podcast" },
];

const AdminPromoCodeManager = () => {
  const { toast } = useToast();
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newPromo, setNewPromo] = useState<Omit<PromoCode, "id">>(DEFAULT_PROMO);

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

  const handleCreatePromo = async () => {
    if (!newPromo.code.trim()) {
      toast({
        title: "Erreur",
        description: "Le code promo ne peut pas être vide",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("promo_codes")
        .insert({
          ...newPromo,
          auto_select_service: newPromo.auto_select_service || null,
        })
        .select()
        .single();

      if (error) throw error;

      setPromoCodes([...promoCodes, data]);
      setNewPromo(DEFAULT_PROMO);
      setIsAddDialogOpen(false);

      toast({
        title: "Code promo créé",
        description: `Le code "${data.code}" a été créé avec succès`,
      });
    } catch (err: any) {
      console.error("Error creating promo code:", err);
      toast({
        title: "Erreur",
        description: err.message?.includes("duplicate")
          ? "Ce code existe déjà"
          : "Impossible de créer le code promo",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePromo = async (id: string, updates: Partial<PromoCode>) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("promo_codes")
        .update(updates)
        .eq("id", id);

      if (error) throw error;

      setPromoCodes((codes) =>
        codes.map((c) => (c.id === id ? { ...c, ...updates } : c))
      );

      toast({
        title: "Mis à jour",
        description: "Code promo mis à jour avec succès",
      });
    } catch (err) {
      console.error("Error updating promo code:", err);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le code promo",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePromo = async (id: string) => {
    setSaving(true);
    try {
      const { error } = await supabase.from("promo_codes").delete().eq("id", id);

      if (error) throw error;

      setPromoCodes((codes) => codes.filter((c) => c.id !== id));

      toast({
        title: "Supprimé",
        description: "Code promo supprimé avec succès",
      });
    } catch (err) {
      console.error("Error deleting promo code:", err);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le code promo",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getPromoSummary = (promo: PromoCode) => {
    const features: string[] = [];
    if (promo.skip_payment) features.push("Sans paiement");
    if (promo.skip_identity_verification) features.push("Sans ID");
    if (promo.skip_form_fields) features.push("Form simplifié");
    if (promo.full_calendar_visibility) features.push("VIP Calendar");
    if (promo.require_full_payment) features.push("Paiement complet");
    if (promo.max_uses_per_user)
      features.push(`Max ${promo.max_uses_per_user}x/user`);
    if (promo.discount_recording && promo.discount_recording > 0)
      features.push(`-${promo.discount_recording}% rec`);
    if (promo.discount_rental && promo.discount_rental > 0)
      features.push(`-${promo.discount_rental}% loc`);
    if (promo.discount_mixing && promo.discount_mixing > 0)
      features.push(`-${promo.discount_mixing}% mix`);
    if (promo.discount_mastering && promo.discount_mastering > 0)
      features.push(`-${promo.discount_mastering}% master`);
    if (promo.custom_price_with_engineer)
      features.push(`${promo.custom_price_with_engineer}€/h ing`);
    if (promo.custom_price_without_engineer)
      features.push(`${promo.custom_price_without_engineer}€/h loc`);
    return features.length > 0 ? features.join(" • ") : "Aucun effet";
  };

  const PromoForm = ({
    promo,
    onChange,
    isNew = false,
  }: {
    promo: Omit<PromoCode, "id"> | PromoCode;
    onChange: (updates: Partial<PromoCode>) => void;
    isNew?: boolean;
  }) => (
    <div className="space-y-4">
      {isNew && (
        <div>
          <Label htmlFor="code" className="text-sm font-medium">
            Code promo
          </Label>
          <Input
            id="code"
            value={promo.code}
            onChange={(e) => onChange({ code: e.target.value.toUpperCase() })}
            placeholder="EX: VIP2024"
            className="mt-1 font-mono"
          />
        </div>
      )}

      {/* Toggle Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-muted-foreground" />
            <Label htmlFor="skip_payment" className="text-sm cursor-pointer">
              Sans paiement
            </Label>
          </div>
          <Switch
            id="skip_payment"
            checked={promo.skip_payment}
            onCheckedChange={(checked) => onChange({ skip_payment: checked })}
          />
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <Label htmlFor="skip_id" className="text-sm cursor-pointer">
              Sans vérification ID
            </Label>
          </div>
          <Switch
            id="skip_id"
            checked={promo.skip_identity_verification}
            onCheckedChange={(checked) =>
              onChange({ skip_identity_verification: checked })
            }
          />
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <Label htmlFor="skip_form" className="text-sm cursor-pointer">
              Formulaire simplifié
            </Label>
          </div>
          <Switch
            id="skip_form"
            checked={promo.skip_form_fields}
            onCheckedChange={(checked) => onChange({ skip_form_fields: checked })}
          />
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Label htmlFor="vip_calendar" className="text-sm cursor-pointer">
              Calendrier VIP complet
            </Label>
          </div>
          <Switch
            id="vip_calendar"
            checked={promo.full_calendar_visibility}
            onCheckedChange={(checked) =>
              onChange({ full_calendar_visibility: checked })
            }
          />
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Euro className="w-4 h-4 text-muted-foreground" />
            <Label htmlFor="full_payment" className="text-sm cursor-pointer">
              Exiger paiement complet
            </Label>
          </div>
          <Switch
            id="full_payment"
            checked={promo.require_full_payment || false}
            onCheckedChange={(checked) =>
              onChange({ require_full_payment: checked })
            }
          />
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-muted-foreground" />
            <Label htmlFor="is_active" className="text-sm cursor-pointer">
              Actif
            </Label>
          </div>
          <Switch
            id="is_active"
            checked={promo.is_active}
            onCheckedChange={(checked) => onChange({ is_active: checked })}
          />
        </div>
      </div>

      {/* Auto-select Service */}
      <div>
        <Label className="text-sm font-medium">
          Sélection automatique du service
        </Label>
        <Select
          value={promo.auto_select_service || ""}
          onValueChange={(value) =>
            onChange({ auto_select_service: value || null })
          }
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Aucun (choix libre)" />
          </SelectTrigger>
          <SelectContent>
            {SERVICE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value || "none"}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Discounts */}
      <div>
        <Label className="text-sm font-medium flex items-center gap-2 mb-2">
          <Percent className="w-4 h-4" />
          Réductions (%)
        </Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <Label htmlFor="discount_recording" className="text-xs text-muted-foreground">
              Enregistrement
            </Label>
            <Input
              id="discount_recording"
              type="number"
              min="0"
              max="100"
              value={promo.discount_recording || 0}
              onChange={(e) =>
                onChange({ discount_recording: Number(e.target.value) || 0 })
              }
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="discount_rental" className="text-xs text-muted-foreground">
              Location
            </Label>
            <Input
              id="discount_rental"
              type="number"
              min="0"
              max="100"
              value={promo.discount_rental || 0}
              onChange={(e) =>
                onChange({ discount_rental: Number(e.target.value) || 0 })
              }
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="discount_mixing" className="text-xs text-muted-foreground">
              Mixage
            </Label>
            <Input
              id="discount_mixing"
              type="number"
              min="0"
              max="100"
              value={promo.discount_mixing || 0}
              onChange={(e) =>
                onChange({ discount_mixing: Number(e.target.value) || 0 })
              }
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="discount_mastering" className="text-xs text-muted-foreground">
              Mastering
            </Label>
            <Input
              id="discount_mastering"
              type="number"
              min="0"
              max="100"
              value={promo.discount_mastering || 0}
              onChange={(e) =>
                onChange({ discount_mastering: Number(e.target.value) || 0 })
              }
              className="mt-1"
            />
          </div>
        </div>
      </div>

      {/* Custom Prices */}
      <div>
        <Label className="text-sm font-medium flex items-center gap-2 mb-2">
          <Euro className="w-4 h-4" />
          Prix personnalisés (€/heure)
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label
              htmlFor="custom_price_with_engineer"
              className="text-xs text-muted-foreground"
            >
              Avec ingénieur
            </Label>
            <Input
              id="custom_price_with_engineer"
              type="number"
              min="0"
              value={promo.custom_price_with_engineer ?? ""}
              onChange={(e) =>
                onChange({
                  custom_price_with_engineer: e.target.value
                    ? Number(e.target.value)
                    : null,
                })
              }
              placeholder="Par défaut"
              className="mt-1"
            />
          </div>
          <div>
            <Label
              htmlFor="custom_price_without_engineer"
              className="text-xs text-muted-foreground"
            >
              Sans ingénieur
            </Label>
            <Input
              id="custom_price_without_engineer"
              type="number"
              min="0"
              value={promo.custom_price_without_engineer ?? ""}
              onChange={(e) =>
                onChange({
                  custom_price_without_engineer: e.target.value
                    ? Number(e.target.value)
                    : null,
                })
              }
              placeholder="Par défaut"
              className="mt-1"
            />
          </div>
        </div>
      </div>

      {/* Usage Limit */}
      <div>
        <Label className="text-sm font-medium flex items-center gap-2 mb-2">
          <Settings2 className="w-4 h-4" />
          Limite d'utilisation par utilisateur
        </Label>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min="0"
            value={promo.max_uses_per_user ?? ""}
            onChange={(e) =>
              onChange({
                max_uses_per_user: e.target.value
                  ? Number(e.target.value)
                  : null,
              })
            }
            placeholder="Illimité"
            className="w-32"
          />
          <span className="text-xs text-muted-foreground">
            (vide = illimité)
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Tag className="w-4 h-4" />
          Gestion des codes promo
        </h3>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Ajouter
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Créer un nouveau code promo</DialogTitle>
            </DialogHeader>
            <PromoForm
              promo={newPromo}
              onChange={(updates) => setNewPromo({ ...newPromo, ...updates })}
              isNew
            />
            <DialogFooter className="mt-4">
              <DialogClose asChild>
                <Button variant="outline">Annuler</Button>
              </DialogClose>
              <Button onClick={handleCreatePromo} disabled={saving}>
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Chargement...
        </div>
      ) : promoCodes.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Aucun code promo configuré
        </div>
      ) : (
        <div className="space-y-2">
          {promoCodes.map((promo) => (
            <Collapsible
              key={promo.id}
              open={expandedId === promo.id}
              onOpenChange={(open) => setExpandedId(open ? promo.id : null)}
            >
              <div
                className={cn(
                  "rounded-lg border transition-colors",
                  promo.is_active
                    ? "bg-primary/5 border-primary/30"
                    : "bg-muted/30 border-border opacity-60"
                )}
              >
                <div className="flex items-center justify-between p-3">
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
                      {getPromoSummary(promo)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Settings2 className="w-4 h-4 mr-1" />
                        {expandedId === promo.id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer ce code ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Le code promo "{promo.code}" sera définitivement
                            supprimé. Cette action est irréversible.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeletePromo(promo.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                <CollapsibleContent>
                  <div className="p-4 pt-0 border-t border-border/50 mt-2">
                    <PromoForm
                      promo={promo}
                      onChange={(updates) => handleUpdatePromo(promo.id, updates)}
                    />
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminPromoCodeManager;
