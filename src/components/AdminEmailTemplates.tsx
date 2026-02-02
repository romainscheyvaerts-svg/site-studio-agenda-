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
  FileText,
  UserCog,
  CreditCard,
  Calendar,
  Music,
  FileQuestion,
  Receipt,
  Check,
  X,
  Clock,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EmailTemplate {
  id: string;
  template_key: string;
  template_name: string;
  template_description: string | null;
  subject_template: string;
  heading_text: string | null;
  subheading_text: string | null;
  body_template: string | null;
  cta_button_text: string | null;
  cta_button_url_template: string | null;
  footer_text: string | null;
  show_logo: boolean;
  show_session_details: boolean;
  show_price: boolean;
  show_calendar_button: boolean;
  show_drive_link: boolean;
  show_social_links: boolean;
  is_active: boolean;
}

// Category definitions with display info
interface CategoryInfo {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const CATEGORIES: CategoryInfo[] = [
  {
    key: "reservations_client",
    label: "📅 RÉSERVATIONS - Emails Client",
    description: "Emails envoyés automatiquement aux clients concernant leurs réservations",
    icon: Calendar,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/20",
  },
  {
    key: "notifications_admin",
    label: "🔔 NOTIFICATIONS ADMIN",
    description: "Emails reçus par l'admin quand un client fait une action (réservation, demande)",
    icon: UserCog,
    color: "text-purple-500",
    bgColor: "bg-purple-500/20",
  },
  {
    key: "notifications_admin_interne",
    label: "👥 NOTIFICATIONS ADMIN INTERNE",
    description: "Emails envoyés entre admins (assignation de session, rappels internes)",
    icon: UserCog,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/20",
  },
  {
    key: "paiements",
    label: "💳 PAIEMENTS & FACTURES",
    description: "Emails liés aux transactions financières et factures",
    icon: CreditCard,
    color: "text-green-500",
    bgColor: "bg-green-500/20",
  },
  {
    key: "devis",
    label: "📋 DEVIS",
    description: "Emails liés aux demandes de devis",
    icon: FileQuestion,
    color: "text-blue-500",
    bgColor: "bg-blue-500/20",
  },
  {
    key: "instrumentaux",
    label: "🎵 INSTRUMENTAUX",
    description: "Emails de livraison après achat d'instrumentaux",
    icon: Music,
    color: "text-primary",
    bgColor: "bg-primary/20",
  },
  {
    key: "communications_admin",
    label: "✉️ COMMUNICATIONS ADMIN",
    description: "Emails personnalisés envoyés manuellement par l'admin aux clients",
    icon: Mail,
    color: "text-orange-500",
    bgColor: "bg-orange-500/20",
  },
];

// Icons and colors for each template type with detailed descriptions
const templateMeta: Record<string, { icon: React.ElementType; color: string; category: string; shortDesc: string }> = {
  // Réservations Client
  booking_confirmed: {
    icon: Check,
    color: "text-green-500",
    category: "reservations_client",
    shortDesc: "Envoyé quand l'admin CONFIRME une réservation"
  },
  booking_rejected: {
    icon: X,
    color: "text-red-500",
    category: "reservations_client",
    shortDesc: "Envoyé quand l'admin REFUSE une réservation (remboursement)"
  },
  booking_pending: {
    icon: Clock,
    color: "text-yellow-500",
    category: "reservations_client",
    shortDesc: "Envoyé quand réservation < 24h (attente confirmation)"
  },
  booking_immediate: {
    icon: Calendar,
    color: "text-cyan-500",
    category: "reservations_client",
    shortDesc: "Confirmation automatique (réservation > 24h)"
  },

  // Notifications Admin
  admin_notification: {
    icon: UserCog,
    color: "text-purple-500",
    category: "notifications_admin",
    shortDesc: "Reçu par l'admin quand un client réserve"
  },
  admin_action_required: {
    icon: AlertTriangle,
    color: "text-orange-500",
    category: "notifications_admin",
    shortDesc: "Demande à l'admin de confirmer/refuser (< 24h)"
  },
  quote_request: {
    icon: FileQuestion,
    color: "text-purple-500",
    category: "notifications_admin",
    shortDesc: "Reçu par l'admin quand demande de devis"
  },

  // Notifications Admin Interne
  admin_session_assignment: {
    icon: Calendar,
    color: "text-emerald-500",
    category: "notifications_admin_interne",
    shortDesc: "Email envoyé à l'admin assigné à une session"
  },

  // Paiements & Factures
  payment_confirmation: {
    icon: CreditCard,
    color: "text-green-500",
    category: "paiements",
    shortDesc: "Confirmation de paiement reçu"
  },
  invoice: {
    icon: Receipt,
    color: "text-gray-400",
    category: "paiements",
    shortDesc: "Envoi de facture au client"
  },

  // Devis
  quote_confirmation: {
    icon: FileText,
    color: "text-blue-500",
    category: "devis",
    shortDesc: "Confirmation envoyée au client après demande de devis"
  },

  // Instrumentaux
  instrumental_delivery: {
    icon: Music,
    color: "text-primary",
    category: "instrumentaux",
    shortDesc: "Email avec lien de téléchargement de l'instrumental"
  },

  // Communications Admin
  admin_session_email: {
    icon: Mail,
    color: "text-orange-500",
    category: "communications_admin",
    shortDesc: "Email personnalisé envoyé par l'admin à un client"
  },
};

// Sample data for preview
const sampleData: Record<string, string> = {
  client_name: "Jean Dupont",
  client_email: "jean.dupont@email.com",
  client_phone: "+32 456 789 123",
  session_date: "15 janvier 2026",
  start_time: "14h00",
  end_time: "17h00",
  service_type: "Session avec ingénieur",
  amount_paid: "135",
  remaining_amount: "67.50",
  total_amount: "135",
  drive_link: "https://drive.google.com/...",
  message: "Je souhaite enregistrer un EP de 4 titres.",
  invoice_number: "INV-2026-001",
  instrumental_title: "Midnight Dreams",
  bpm: "140",
  key: "Am",
  license_type: "Licence Exclusive",
};

// Replace template variables with sample data
const replaceVariables = (text: string | null): string => {
  if (!text) return "";
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => sampleData[key] || match);
};

const TemplateEditor = ({
  template,
  onSave,
  saving,
}: {
  template: EmailTemplate;
  onSave: (template: EmailTemplate) => void;
  saving: boolean;
}) => {
  const [editedTemplate, setEditedTemplate] = useState<EmailTemplate>(template);
  const [isExpanded, setIsExpanded] = useState(false);

  const hasChanges = JSON.stringify(editedTemplate) !== JSON.stringify(template);

  const meta = templateMeta[template.template_key] || { icon: Mail, color: "text-muted-foreground", category: "autre", shortDesc: "" };
  const Icon = meta.icon;
  const categoryInfo = CATEGORIES.find(c => c.key === meta.category);

  const updateField = (field: keyof EmailTemplate, value: string | boolean) => {
    setEditedTemplate({ ...editedTemplate, [field]: value });
  };

  // Render email preview
  const renderPreview = () => {
    const subject = replaceVariables(editedTemplate.subject_template);
    const heading = replaceVariables(editedTemplate.heading_text);
    const subheading = replaceVariables(editedTemplate.subheading_text);
    const body = replaceVariables(editedTemplate.body_template);
    const ctaText = editedTemplate.cta_button_text;

    return (
      <div className="mt-4 border border-border rounded-lg overflow-hidden">
        {/* Email Subject Preview */}
        <div className="bg-secondary/50 p-3 border-b border-border">
          <p className="text-xs text-muted-foreground">Sujet:</p>
          <p className="text-sm font-medium text-foreground">{subject}</p>
        </div>

        {/* Email Body Preview */}
        <div style={{ backgroundColor: "#0a0a0a", padding: "24px" }}>
          <div
            style={{
              maxWidth: "500px",
              margin: "0 auto",
              backgroundColor: "#1a1a1a",
              borderRadius: "12px",
              border: "1px solid #262626",
              overflow: "hidden",
              fontFamily: "Arial, sans-serif",
            }}
          >
            {/* Header */}
            <div
              style={{
                background: "linear-gradient(135deg, rgba(34,211,238,0.2), rgba(124,58,237,0.2))",
                padding: "20px",
                textAlign: "center" as const,
                borderBottom: "1px solid #262626",
              }}
            >
              {editedTemplate.show_logo && (
                <img
                  src="https://www.studiomakemusic.com/favicon.png"
                  alt="Logo"
                  style={{ width: "50px", height: "50px", margin: "0 auto 10px", borderRadius: "8px" }}
                />
              )}
              <h1 style={{ color: "#ffffff", fontSize: "18px", fontWeight: "bold", margin: 0 }}>
                Make Music Studio
              </h1>
            </div>

            {/* Body */}
            <div style={{ padding: "20px" }}>
              {heading && (
                <h2 style={{ color: "#ffffff", fontSize: "18px", marginBottom: "8px", marginTop: 0 }}>
                  {heading}
                </h2>
              )}
              {subheading && (
                <p style={{ color: "#a1a1aa", fontSize: "13px", marginBottom: "16px", marginTop: 0 }}>
                  {subheading}
                </p>
              )}

              {/* Body text */}
              <div
                style={{
                  color: "#a1a1aa",
                  fontSize: "13px",
                  lineHeight: "1.6",
                  whiteSpace: "pre-wrap",
                }}
              >
                {body.split("\n").map((line, i) => (
                  <p key={i} style={{ margin: "8px 0" }}>
                    {line.includes("{{") ? (
                      <span style={{ color: "#22d3ee" }}>{line}</span>
                    ) : (
                      line
                    )}
                  </p>
                ))}
              </div>

              {/* Session Details */}
              {editedTemplate.show_session_details && (
                <div
                  style={{
                    backgroundColor: "#0a0a0a",
                    borderRadius: "8px",
                    padding: "12px",
                    marginTop: "16px",
                    border: "1px solid #262626",
                  }}
                >
                  <p style={{ color: "#a1a1aa", fontSize: "11px", margin: "0 0 6px" }}>
                    Détails de la session
                  </p>
                  <p style={{ color: "#ffffff", fontSize: "13px", margin: 0 }}>
                    <strong>{sampleData.service_type}</strong> - 3 heures
                  </p>
                  {editedTemplate.show_price && (
                    <p style={{ color: "#10b981", fontSize: "16px", fontWeight: "bold", margin: "6px 0 0" }}>
                      {sampleData.amount_paid}€
                    </p>
                  )}
                </div>
              )}

              {/* Drive Link */}
              {editedTemplate.show_drive_link && (
                <div
                  style={{
                    backgroundColor: "rgba(66, 133, 244, 0.1)",
                    borderRadius: "8px",
                    padding: "12px",
                    marginTop: "12px",
                    border: "1px solid rgba(66, 133, 244, 0.3)",
                  }}
                >
                  <p style={{ color: "#4285F4", fontSize: "12px", margin: 0 }}>
                    📁 Dossier Google Drive créé
                  </p>
                </div>
              )}

              {/* CTA Button */}
              {ctaText && editedTemplate.show_calendar_button && (
                <div style={{ marginTop: "20px", textAlign: "center" as const }}>
                  <span
                    style={{
                      display: "inline-block",
                      backgroundColor: "#22d3ee",
                      color: "#0a0a0a",
                      padding: "10px 20px",
                      borderRadius: "8px",
                      fontWeight: "bold",
                      fontSize: "13px",
                    }}
                  >
                    {ctaText}
                  </span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                backgroundColor: "#0a0a0a",
                padding: "16px",
                borderTop: "1px solid #262626",
                textAlign: "center" as const,
              }}
            >
              <p style={{ color: "#a1a1aa", fontSize: "11px", margin: 0 }}>
                {editedTemplate.footer_text || "Make Music Studio - Studio d'enregistrement à Bruxelles"}
              </p>
              {editedTemplate.show_social_links && (
                <div style={{ marginTop: "10px" }}>
                  <span style={{ color: "#22d3ee", fontSize: "11px", margin: "0 8px" }}>Instagram</span>
                  <span style={{ color: "#22d3ee", fontSize: "11px", margin: "0 8px" }}>Facebook</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between bg-card hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", `bg-${meta.color.replace('text-', '')}/20`)}>
            <Icon className={cn("w-4 h-4", meta.color)} />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-foreground">{template.template_name}</span>
              {hasChanges && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500">
                  Modifié
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{meta.shortDesc || template.template_description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={editedTemplate.is_active}
            onCheckedChange={(v) => updateField("is_active", v)}
            onClick={(e) => e.stopPropagation()}
          />
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="p-4 border-t border-border bg-secondary/10">
          {/* Layout: Editor on left, Preview on right */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* LEFT: Editor Fields */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-4 h-4 text-primary" />
                <Label className="text-sm font-medium text-foreground">Édition du template</Label>
              </div>

              {/* Subject */}
              <div>
                <Label className="text-sm text-muted-foreground">Sujet de l'email</Label>
                <Input
                  value={editedTemplate.subject_template}
                  onChange={(e) => updateField("subject_template", e.target.value)}
                  className="mt-1"
                  placeholder="Sujet..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Variables: {"{{client_name}}, {{session_date}}, {{service_type}}, {{amount_paid}}"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Heading */}
                <div>
                  <Label className="text-sm text-muted-foreground">Titre principal</Label>
                  <Input
                    value={editedTemplate.heading_text || ""}
                    onChange={(e) => updateField("heading_text", e.target.value)}
                    className="mt-1"
                    placeholder="Titre de l'email..."
                  />
                </div>

                {/* Subheading */}
                <div>
                  <Label className="text-sm text-muted-foreground">Sous-titre</Label>
                  <Input
                    value={editedTemplate.subheading_text || ""}
                    onChange={(e) => updateField("subheading_text", e.target.value)}
                    className="mt-1"
                    placeholder="Sous-titre..."
                  />
                </div>
              </div>

              {/* Body */}
              <div>
                <Label className="text-sm text-muted-foreground">Corps du message</Label>
                <Textarea
                  value={editedTemplate.body_template || ""}
                  onChange={(e) => updateField("body_template", e.target.value)}
                  className="mt-1 min-h-[180px] font-mono text-sm"
                  placeholder="Contenu de l'email..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Variables: {"{{client_name}}, {{session_date}}, {{start_time}}, {{end_time}}, {{service_type}}, {{amount_paid}}, {{drive_link}}, {{message}}"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* CTA Button Text */}
                <div>
                  <Label className="text-sm text-muted-foreground">Texte du bouton</Label>
                  <Input
                    value={editedTemplate.cta_button_text || ""}
                    onChange={(e) => updateField("cta_button_text", e.target.value)}
                    className="mt-1"
                    placeholder="Ex: Ajouter à mon agenda"
                  />
                </div>

                {/* Footer */}
                <div>
                  <Label className="text-sm text-muted-foreground">Footer personnalisé</Label>
                  <Input
                    value={editedTemplate.footer_text || ""}
                    onChange={(e) => updateField("footer_text", e.target.value)}
                    className="mt-1"
                    placeholder="Texte du footer..."
                  />
                </div>
              </div>

              {/* Options */}
              <div className="pt-4 border-t border-border">
                <Label className="text-sm text-foreground mb-3 block">Options d'affichage</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <div className="flex items-center justify-between p-2 rounded bg-secondary/50">
                    <span className="text-xs">Logo</span>
                    <Switch
                      checked={editedTemplate.show_logo}
                      onCheckedChange={(v) => updateField("show_logo", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-secondary/50">
                    <span className="text-xs">Détails session</span>
                    <Switch
                      checked={editedTemplate.show_session_details}
                      onCheckedChange={(v) => updateField("show_session_details", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-secondary/50">
                    <span className="text-xs">Prix</span>
                    <Switch
                      checked={editedTemplate.show_price}
                      onCheckedChange={(v) => updateField("show_price", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-secondary/50">
                    <span className="text-xs">Bouton agenda</span>
                    <Switch
                      checked={editedTemplate.show_calendar_button}
                      onCheckedChange={(v) => updateField("show_calendar_button", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-secondary/50">
                    <span className="text-xs">Lien Drive</span>
                    <Switch
                      checked={editedTemplate.show_drive_link}
                      onCheckedChange={(v) => updateField("show_drive_link", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-secondary/50">
                    <span className="text-xs">Réseaux sociaux</span>
                    <Switch
                      checked={editedTemplate.show_social_links}
                      onCheckedChange={(v) => updateField("show_social_links", v)}
                    />
                  </div>
                </div>
              </div>

              {/* Save Button */}
              {hasChanges && (
                <div className="flex justify-end pt-4">
                  <Button
                    onClick={() => onSave(editedTemplate)}
                    disabled={saving}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Sauvegarder ce template
                  </Button>
                </div>
              )}
            </div>

            {/* RIGHT: Live Preview - Always visible */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-4">
                <Eye className="w-4 h-4 text-green-500" />
                <Label className="text-sm font-medium text-foreground">Aperçu en direct</Label>
                {hasChanges && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500 animate-pulse">
                    Non sauvegardé
                  </span>
                )}
              </div>
              {renderPreview()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminEmailTemplates = () => {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("template_name");

      if (error) throw error;
      setTemplates(data as EmailTemplate[]);
    } catch (err) {
      console.error("Error fetching email templates:", err);
      toast({
        title: "Erreur",
        description: "Impossible de charger les templates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded) {
      fetchTemplates();
    }
  }, [expanded]);

  const handleSaveTemplate = async (template: EmailTemplate) => {
    setSavingId(template.id);
    try {
      const { error } = await supabase
        .from("email_templates")
        .update({
          subject_template: template.subject_template,
          heading_text: template.heading_text,
          subheading_text: template.subheading_text,
          body_template: template.body_template,
          cta_button_text: template.cta_button_text,
          cta_button_url_template: template.cta_button_url_template,
          footer_text: template.footer_text,
          show_logo: template.show_logo,
          show_session_details: template.show_session_details,
          show_price: template.show_price,
          show_calendar_button: template.show_calendar_button,
          show_drive_link: template.show_drive_link,
          show_social_links: template.show_social_links,
          is_active: template.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", template.id);

      if (error) throw error;

      // Update local state
      setTemplates(templates.map((t) => (t.id === template.id ? template : t)));

      toast({
        title: "Template sauvegardé !",
        description: `Le template "${template.template_name}" a été mis à jour.`,
      });
    } catch (err) {
      console.error("Error saving template:", err);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder le template",
        variant: "destructive",
      });
    } finally {
      setSavingId(null);
    }
  };

  // Group templates by category
  const getTemplatesByCategory = (categoryKey: string) => {
    return templates.filter(
      (t) => templateMeta[t.template_key]?.category === categoryKey
    );
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between bg-card hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-primary" />
          <span className="font-display text-lg text-foreground">TEMPLATES D'EMAILS</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
            {templates.length} templates
          </span>
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
          ) : (
            <>
              {/* Render templates grouped by category */}
              {CATEGORIES.map((category) => {
                const categoryTemplates = getTemplatesByCategory(category.key);
                if (categoryTemplates.length === 0) return null;

                const CategoryIcon = category.icon;

                return (
                  <div key={category.key} className="space-y-3">
                    {/* Category Header */}
                    <div className={cn("p-3 rounded-lg", category.bgColor)}>
                      <div className="flex items-center gap-2">
                        <CategoryIcon className={cn("w-5 h-5", category.color)} />
                        <h4 className="font-display text-sm text-foreground">
                          {category.label} ({categoryTemplates.length})
                        </h4>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 ml-7">
                        {category.description}
                      </p>
                    </div>

                    {/* Templates in this category */}
                    <div className="space-y-2 ml-2">
                      {categoryTemplates.map((template) => (
                        <TemplateEditor
                          key={template.id}
                          template={template}
                          onSave={handleSaveTemplate}
                          saving={savingId === template.id}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}

              {templates.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Aucun template trouvé.</p>
                  <p className="text-sm">Exécutez la migration SQL pour créer les templates par défaut.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminEmailTemplates;
