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
  User,
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
  EyeOff,
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

// Icons and colors for each template type
const templateMeta: Record<string, { icon: React.ElementType; color: string; category: string }> = {
  booking_confirmed: { icon: Check, color: "text-green-500", category: "Client" },
  booking_rejected: { icon: X, color: "text-red-500", category: "Client" },
  booking_pending: { icon: Clock, color: "text-yellow-500", category: "Client" },
  booking_immediate: { icon: Calendar, color: "text-green-500", category: "Client" },
  admin_session_email: { icon: Mail, color: "text-blue-500", category: "Client" },
  admin_notification: { icon: UserCog, color: "text-purple-500", category: "Admin" },
  admin_action_required: { icon: AlertTriangle, color: "text-orange-500", category: "Admin" },
  payment_confirmation: { icon: CreditCard, color: "text-green-500", category: "Client" },
  quote_request: { icon: FileQuestion, color: "text-blue-500", category: "Admin" },
  quote_confirmation: { icon: FileText, color: "text-blue-500", category: "Client" },
  invoice: { icon: Receipt, color: "text-gray-500", category: "Client" },
  instrumental_delivery: { icon: Music, color: "text-primary", category: "Client" },
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
  const [showPreview, setShowPreview] = useState(false);

  const hasChanges = JSON.stringify(editedTemplate) !== JSON.stringify(template);

  const meta = templateMeta[template.template_key] || { icon: Mail, color: "text-muted-foreground", category: "Autre" };
  const Icon = meta.icon;

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
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">{template.template_name}</span>
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full",
                meta.category === "Admin" ? "bg-purple-500/20 text-purple-500" : "bg-primary/20 text-primary"
              )}>
                {meta.category}
              </span>
              {hasChanges && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500">
                  Modifié
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{template.template_description}</p>
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
        <div className="p-4 border-t border-border space-y-4 bg-secondary/10">
          {/* Preview Toggle */}
          <div className="flex items-center justify-between">
            <Label className="text-sm text-foreground">Aperçu de l'email</Label>
            <Button
              variant={showPreview ? "default" : "outline"}
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? (
                <>
                  <EyeOff className="w-4 h-4 mr-2" />
                  Masquer l'aperçu
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Voir l'aperçu
                </>
              )}
            </Button>
          </div>

          {/* Preview */}
          {showPreview && renderPreview()}

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

          <div className="grid md:grid-cols-2 gap-4">
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
              className="mt-1 min-h-[150px] font-mono text-sm"
              placeholder="Contenu de l'email..."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Variables disponibles: {"{{client_name}}, {{client_email}}, {{session_date}}, {{start_time}}, {{end_time}}, {{service_type}}, {{amount_paid}}, {{remaining_amount}}, {{drive_link}}, {{message}}"}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
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
              <Label className="text-sm text-muted-foreground">Footer personnalisé (optionnel)</Label>
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="flex items-center justify-between p-2 rounded bg-secondary/50">
                <span className="text-sm">Logo</span>
                <Switch
                  checked={editedTemplate.show_logo}
                  onCheckedChange={(v) => updateField("show_logo", v)}
                />
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-secondary/50">
                <span className="text-sm">Détails session</span>
                <Switch
                  checked={editedTemplate.show_session_details}
                  onCheckedChange={(v) => updateField("show_session_details", v)}
                />
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-secondary/50">
                <span className="text-sm">Prix</span>
                <Switch
                  checked={editedTemplate.show_price}
                  onCheckedChange={(v) => updateField("show_price", v)}
                />
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-secondary/50">
                <span className="text-sm">Bouton agenda</span>
                <Switch
                  checked={editedTemplate.show_calendar_button}
                  onCheckedChange={(v) => updateField("show_calendar_button", v)}
                />
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-secondary/50">
                <span className="text-sm">Lien Drive</span>
                <Switch
                  checked={editedTemplate.show_drive_link}
                  onCheckedChange={(v) => updateField("show_drive_link", v)}
                />
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-secondary/50">
                <span className="text-sm">Réseaux sociaux</span>
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
  const clientTemplates = templates.filter(
    (t) => templateMeta[t.template_key]?.category === "Client"
  );
  const adminTemplates = templates.filter(
    (t) => templateMeta[t.template_key]?.category === "Admin"
  );

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
              {/* Client Templates */}
              {clientTemplates.length > 0 && (
                <div>
                  <h4 className="font-display text-sm text-foreground mb-3 flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    EMAILS CLIENTS ({clientTemplates.length})
                  </h4>
                  <div className="space-y-2">
                    {clientTemplates.map((template) => (
                      <TemplateEditor
                        key={template.id}
                        template={template}
                        onSave={handleSaveTemplate}
                        saving={savingId === template.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Admin Templates */}
              {adminTemplates.length > 0 && (
                <div>
                  <h4 className="font-display text-sm text-foreground mb-3 flex items-center gap-2">
                    <UserCog className="w-4 h-4 text-purple-500" />
                    EMAILS ADMIN ({adminTemplates.length})
                  </h4>
                  <div className="space-y-2">
                    {adminTemplates.map((template) => (
                      <TemplateEditor
                        key={template.id}
                        template={template}
                        onSave={handleSaveTemplate}
                        saving={savingId === template.id}
                      />
                    ))}
                  </div>
                </div>
              )}

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
