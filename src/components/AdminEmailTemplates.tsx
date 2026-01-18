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

  const meta = templateMeta[template.template_key] || { icon: Mail, color: "text-muted-foreground", category: "Autre" };
  const Icon = meta.icon;

  const updateField = (field: keyof EmailTemplate, value: string | boolean) => {
    setEditedTemplate({ ...editedTemplate, [field]: value });
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
