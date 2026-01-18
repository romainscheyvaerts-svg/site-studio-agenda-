import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Mail,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Palette,
  Type,
  Image,
  Instagram,
  Facebook,
  Youtube,
  Calendar,
  Eye,
  MapPin,
  Phone,
  AtSign,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EmailConfig {
  id: string;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  card_color: string;
  text_color: string;
  muted_text_color: string;
  border_color: string;
  success_color: string;
  logo_url: string | null;
  studio_name: string;
  footer_text: string | null;
  footer_address: string | null;
  footer_phone: string | null;
  footer_email: string | null;
  social_instagram: string | null;
  social_facebook: string | null;
  social_youtube: string | null;
  social_tiktok: string | null;
  show_calendar_button: boolean;
  show_social_links: boolean;
  show_logo: boolean;
  font_family: string;
}

const DEFAULT_CONFIG: Omit<EmailConfig, "id"> = {
  primary_color: "#22d3ee",
  secondary_color: "#7c3aed",
  background_color: "#0a0a0a",
  card_color: "#1a1a1a",
  text_color: "#ffffff",
  muted_text_color: "#a1a1aa",
  border_color: "#262626",
  success_color: "#10b981",
  logo_url: "https://www.studiomakemusic.com/favicon.png",
  studio_name: "Make Music Studio",
  footer_text: "Make Music Studio - Studio d'enregistrement professionnel à Bruxelles",
  footer_address: "Rue de la Loi 42, 1000 Bruxelles",
  footer_phone: "+32 456 123 789",
  footer_email: "prod.makemusic@gmail.com",
  social_instagram: "https://instagram.com/makemusic.studio",
  social_facebook: "",
  social_youtube: "",
  social_tiktok: "",
  show_calendar_button: true,
  show_social_links: true,
  show_logo: true,
  font_family: "Arial, Helvetica, sans-serif",
};

const ColorPicker = ({
  label,
  value,
  onChange,
  icon: Icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon?: React.ElementType;
}) => (
  <div className="flex items-center gap-3">
    <div
      className="w-10 h-10 rounded-lg border border-border cursor-pointer relative overflow-hidden"
      style={{ backgroundColor: value }}
    >
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
      />
    </div>
    <div className="flex-1">
      <Label className="text-sm text-foreground flex items-center gap-2">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-xs font-mono mt-1"
        placeholder="#000000"
      />
    </div>
  </div>
);

const AdminEmailConfig = () => {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [originalConfig, setOriginalConfig] = useState<EmailConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("email_config")
        .select("*")
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setConfig(data as EmailConfig);
        setOriginalConfig(data as EmailConfig);
      } else {
        // Create default config if none exists
        const newConfig = { ...DEFAULT_CONFIG, id: "00000000-0000-0000-0000-000000000001" } as EmailConfig;
        setConfig(newConfig);
        setOriginalConfig(newConfig);
      }
    } catch (err) {
      console.error("Error fetching email config:", err);
      const fallbackConfig = { ...DEFAULT_CONFIG, id: "temp" } as EmailConfig;
      setConfig(fallbackConfig);
      setOriginalConfig(fallbackConfig);
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
    if (!config) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("email_config")
        .upsert({
          id: config.id === "temp" ? "00000000-0000-0000-0000-000000000001" : config.id,
          ...config,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      setOriginalConfig(config);
      toast({
        title: "Configuration sauvegardée !",
        description: "Le template email a été mis à jour.",
      });
    } catch (err) {
      console.error("Error saving email config:", err);
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
    setConfig({ ...DEFAULT_CONFIG, id: config?.id || "temp" } as EmailConfig);
  };

  const updateConfig = (key: keyof EmailConfig, value: string | boolean) => {
    if (!config) return;
    setConfig({ ...config, [key]: value });
  };

  const hasChanges = config && originalConfig && JSON.stringify(config) !== JSON.stringify(originalConfig);

  const renderEmailPreview = () => {
    if (!config) return null;
    return (
      <div
        className="rounded-lg overflow-hidden border border-border"
        style={{ fontFamily: config.font_family }}
      >
        {/* Email Preview */}
        <div style={{ backgroundColor: config.background_color, padding: "32px" }}>
          <div
            style={{
              maxWidth: "600px",
              margin: "0 auto",
              backgroundColor: config.card_color,
              borderRadius: "16px",
              border: `1px solid ${config.border_color}`,
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                background: `linear-gradient(135deg, ${config.primary_color}20, ${config.secondary_color}20)`,
                padding: "24px",
                textAlign: "center" as const,
                borderBottom: `1px solid ${config.border_color}`,
              }}
            >
              {config.show_logo && config.logo_url && (
                <img
                  src={config.logo_url}
                  alt="Logo"
                  style={{ width: "60px", height: "60px", margin: "0 auto 12px", borderRadius: "8px" }}
                />
              )}
              <h1 style={{ color: config.text_color, fontSize: "24px", fontWeight: "bold", margin: 0 }}>
                {config.studio_name}
              </h1>
            </div>

            {/* Body */}
            <div style={{ padding: "24px" }}>
              <h2 style={{ color: config.text_color, fontSize: "20px", marginBottom: "16px" }}>
                🎉 Réservation Confirmée !
              </h2>
              <p style={{ color: config.muted_text_color, fontSize: "14px", lineHeight: "1.6" }}>
                Bonjour <strong style={{ color: config.text_color }}>Jean Dupont</strong>,
              </p>
              <p style={{ color: config.muted_text_color, fontSize: "14px", lineHeight: "1.6" }}>
                Votre session d'enregistrement est confirmée pour le <strong style={{ color: config.primary_color }}>15 janvier 2026 à 14h00</strong>.
              </p>

              {/* Session Box */}
              <div
                style={{
                  backgroundColor: config.background_color,
                  borderRadius: "8px",
                  padding: "16px",
                  marginTop: "16px",
                  border: `1px solid ${config.border_color}`,
                }}
              >
                <p style={{ color: config.muted_text_color, fontSize: "12px", margin: "0 0 8px" }}>Détails de la session</p>
                <p style={{ color: config.text_color, fontSize: "14px", margin: 0 }}>
                  <strong>Session avec ingénieur</strong> - 3 heures
                </p>
                <p style={{ color: config.success_color, fontSize: "18px", fontWeight: "bold", margin: "8px 0 0" }}>
                  135€
                </p>
              </div>

              {/* Calendar Button */}
              {config.show_calendar_button && (
                <div style={{ marginTop: "20px", textAlign: "center" as const }}>
                  <a
                    href="#"
                    style={{
                      display: "inline-block",
                      backgroundColor: config.primary_color,
                      color: config.background_color,
                      padding: "12px 24px",
                      borderRadius: "8px",
                      textDecoration: "none",
                      fontWeight: "bold",
                      fontSize: "14px",
                    }}
                  >
                    <Calendar style={{ width: "16px", height: "16px", display: "inline", marginRight: "8px", verticalAlign: "middle" }} />
                    Ajouter à mon agenda
                  </a>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                backgroundColor: config.background_color,
                padding: "20px",
                borderTop: `1px solid ${config.border_color}`,
                textAlign: "center" as const,
              }}
            >
              {config.footer_text && (
                <p style={{ color: config.muted_text_color, fontSize: "12px", margin: "0 0 8px" }}>
                  {config.footer_text}
                </p>
              )}
              {config.footer_address && (
                <p style={{ color: config.muted_text_color, fontSize: "11px", margin: "0 0 4px" }}>
                  📍 {config.footer_address}
                </p>
              )}
              {config.footer_phone && (
                <p style={{ color: config.muted_text_color, fontSize: "11px", margin: "0 0 4px" }}>
                  📞 {config.footer_phone}
                </p>
              )}
              {config.footer_email && (
                <p style={{ color: config.muted_text_color, fontSize: "11px", margin: "0 0 12px" }}>
                  ✉️ {config.footer_email}
                </p>
              )}

              {/* Social Links */}
              {config.show_social_links && (config.social_instagram || config.social_facebook || config.social_youtube) && (
                <div style={{ marginTop: "12px" }}>
                  {config.social_instagram && (
                    <a href={config.social_instagram} style={{ margin: "0 8px", color: config.primary_color }}>
                      Instagram
                    </a>
                  )}
                  {config.social_facebook && (
                    <a href={config.social_facebook} style={{ margin: "0 8px", color: config.primary_color }}>
                      Facebook
                    </a>
                  )}
                  {config.social_youtube && (
                    <a href={config.social_youtube} style={{ margin: "0 8px", color: config.primary_color }}>
                      YouTube
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between bg-card hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5 text-primary" />
          <span className="font-display text-lg text-foreground">PERSONNALISATION DES EMAILS</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="p-4 border-t border-border space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : config ? (
            <>
              {/* Preview Toggle */}
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Aperçu en direct</Label>
                <Button
                  variant={showPreview ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  {showPreview ? "Masquer" : "Afficher"} l'aperçu
                </Button>
              </div>

              {showPreview && (
                <div className="animate-in fade-in-0 slide-in-from-top-2">
                  {renderEmailPreview()}
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                {/* Colors Section */}
                <div className="space-y-4">
                  <h4 className="font-display text-sm text-foreground flex items-center gap-2">
                    <Palette className="w-4 h-4 text-primary" />
                    COULEURS
                  </h4>
                  <div className="grid gap-4">
                    <ColorPicker
                      label="Couleur principale (boutons)"
                      value={config.primary_color}
                      onChange={(v) => updateConfig("primary_color", v)}
                    />
                    <ColorPicker
                      label="Couleur secondaire"
                      value={config.secondary_color}
                      onChange={(v) => updateConfig("secondary_color", v)}
                    />
                    <ColorPicker
                      label="Fond de l'email"
                      value={config.background_color}
                      onChange={(v) => updateConfig("background_color", v)}
                    />
                    <ColorPicker
                      label="Fond des cartes"
                      value={config.card_color}
                      onChange={(v) => updateConfig("card_color", v)}
                    />
                    <ColorPicker
                      label="Texte principal"
                      value={config.text_color}
                      onChange={(v) => updateConfig("text_color", v)}
                    />
                    <ColorPicker
                      label="Texte secondaire"
                      value={config.muted_text_color}
                      onChange={(v) => updateConfig("muted_text_color", v)}
                    />
                    <ColorPicker
                      label="Bordures"
                      value={config.border_color}
                      onChange={(v) => updateConfig("border_color", v)}
                    />
                    <ColorPicker
                      label="Succès (prix, confirmation)"
                      value={config.success_color}
                      onChange={(v) => updateConfig("success_color", v)}
                    />
                  </div>
                </div>

                {/* Branding & Content Section */}
                <div className="space-y-4">
                  <h4 className="font-display text-sm text-foreground flex items-center gap-2">
                    <Image className="w-4 h-4 text-primary" />
                    BRANDING
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm text-muted-foreground">Nom du studio</Label>
                      <Input
                        value={config.studio_name}
                        onChange={(e) => updateConfig("studio_name", e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">URL du logo</Label>
                      <Input
                        value={config.logo_url || ""}
                        onChange={(e) => updateConfig("logo_url", e.target.value)}
                        placeholder="https://..."
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Police d'écriture</Label>
                      <Input
                        value={config.font_family}
                        onChange={(e) => updateConfig("font_family", e.target.value)}
                        placeholder="Arial, sans-serif"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <h4 className="font-display text-sm text-foreground flex items-center gap-2 pt-4">
                    <MapPin className="w-4 h-4 text-primary" />
                    FOOTER
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm text-muted-foreground">Texte du footer</Label>
                      <Textarea
                        value={config.footer_text || ""}
                        onChange={(e) => updateConfig("footer_text", e.target.value)}
                        className="mt-1 min-h-[60px]"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> Adresse
                      </Label>
                      <Input
                        value={config.footer_address || ""}
                        onChange={(e) => updateConfig("footer_address", e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" /> Téléphone
                      </Label>
                      <Input
                        value={config.footer_phone || ""}
                        onChange={(e) => updateConfig("footer_phone", e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground flex items-center gap-1">
                        <AtSign className="w-3 h-3" /> Email
                      </Label>
                      <Input
                        value={config.footer_email || ""}
                        onChange={(e) => updateConfig("footer_email", e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Social Links */}
              <div className="space-y-4 pt-4 border-t border-border">
                <h4 className="font-display text-sm text-foreground flex items-center gap-2">
                  <Instagram className="w-4 h-4 text-primary" />
                  RÉSEAUX SOCIAUX
                </h4>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm text-muted-foreground flex items-center gap-1">
                      <Instagram className="w-3 h-3" /> Instagram
                    </Label>
                    <Input
                      value={config.social_instagram || ""}
                      onChange={(e) => updateConfig("social_instagram", e.target.value)}
                      placeholder="https://instagram.com/..."
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground flex items-center gap-1">
                      <Facebook className="w-3 h-3" /> Facebook
                    </Label>
                    <Input
                      value={config.social_facebook || ""}
                      onChange={(e) => updateConfig("social_facebook", e.target.value)}
                      placeholder="https://facebook.com/..."
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground flex items-center gap-1">
                      <Youtube className="w-3 h-3" /> YouTube
                    </Label>
                    <Input
                      value={config.social_youtube || ""}
                      onChange={(e) => updateConfig("social_youtube", e.target.value)}
                      placeholder="https://youtube.com/..."
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">TikTok</Label>
                    <Input
                      value={config.social_tiktok || ""}
                      onChange={(e) => updateConfig("social_tiktok", e.target.value)}
                      placeholder="https://tiktok.com/..."
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Feature Toggles */}
              <div className="space-y-4 pt-4 border-t border-border">
                <h4 className="font-display text-sm text-foreground">OPTIONS</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                    <div className="flex items-center gap-2">
                      <Image className="w-4 h-4 text-primary" />
                      <Label>Afficher le logo</Label>
                    </div>
                    <Switch
                      checked={config.show_logo}
                      onCheckedChange={(v) => updateConfig("show_logo", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      <Label>Bouton "Ajouter au calendrier"</Label>
                    </div>
                    <Switch
                      checked={config.show_calendar_button}
                      onCheckedChange={(v) => updateConfig("show_calendar_button", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                    <div className="flex items-center gap-2">
                      <Instagram className="w-4 h-4 text-primary" />
                      <Label>Afficher les réseaux sociaux</Label>
                    </div>
                    <Switch
                      checked={config.show_social_links}
                      onCheckedChange={(v) => updateConfig("show_social_links", v)}
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 justify-between pt-4 border-t border-border">
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
                  {hasChanges ? "Sauvegarder" : "Aucune modification"}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default AdminEmailConfig;
