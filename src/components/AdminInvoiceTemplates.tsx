import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
  Building2,
  Palette,
  Eye,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface InvoiceTemplate {
  id: string;
  template_key: string;
  template_name: string;
  template_description: string | null;
  company_name: string;
  company_address: string | null;
  company_email: string | null;
  company_phone: string | null;
  company_logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  text_color: string;
  accent_color: string;
  show_logo: boolean;
  header_title: string;
  footer_text: string | null;
  show_footer: boolean;
  legal_mentions: string | null;
  payment_terms: string | null;
  bank_details: string | null;
  vat_number: string | null;
  is_active: boolean;
}

// Sample invoice data for preview
const sampleInvoiceData = {
  invoiceNumber: "FAC-2026-001",
  date: "2 février 2026",
  dueDate: "16 février 2026",
  clientName: "Jean Dupont",
  clientEmail: "jean.dupont@email.com",
  clientAddress: "123 Rue de la Musique\n1000 Bruxelles",
  items: [
    { description: "Session d'enregistrement avec ingénieur son", quantity: 4, unitPrice: 45, total: 180 },
    { description: "Mixage projet", quantity: 1, unitPrice: 150, total: 150 },
  ],
  total: 330,
};

const AdminInvoiceTemplates = () => {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [template, setTemplate] = useState<InvoiceTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalTemplate, setOriginalTemplate] = useState<InvoiceTemplate | null>(null);

  const fetchTemplate = async () => {
    setLoading(true);
    try {
      // Using 'any' cast because invoice_templates table needs type regeneration after migration
      const { data, error } = await (supabase as any)
        .from("invoice_templates")
        .select("*")
        .eq("template_key", "default")
        .single();

      if (error) {
        // If table doesn't exist yet, show a message
        if (error.code === "42P01" || error.code === "PGRST116") {
          console.log("Invoice templates table not found, migration needed");
          toast({
            title: "Migration requise",
            description: "Exécutez la migration SQL pour créer la table invoice_templates",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }
      
      setTemplate(data as unknown as InvoiceTemplate);
      setOriginalTemplate(data as unknown as InvoiceTemplate);
    } catch (err) {
      console.error("Error fetching invoice template:", err);
      toast({
        title: "Erreur",
        description: "Impossible de charger le template de facture",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded && !template) {
      fetchTemplate();
    }
  }, [expanded]);

  useEffect(() => {
    if (template && originalTemplate) {
      setHasChanges(JSON.stringify(template) !== JSON.stringify(originalTemplate));
    }
  }, [template, originalTemplate]);

  const updateField = (field: keyof InvoiceTemplate, value: string | boolean) => {
    if (template) {
      setTemplate({ ...template, [field]: value });
    }
  };

  const handleSave = async () => {
    if (!template) return;
    
    setSaving(true);
    try {
      // Using 'any' cast because invoice_templates table needs type regeneration after migration
      const { error } = await (supabase as any)
        .from("invoice_templates")
        .update({
          company_name: template.company_name,
          company_address: template.company_address,
          company_email: template.company_email,
          company_phone: template.company_phone,
          company_logo_url: template.company_logo_url,
          primary_color: template.primary_color,
          secondary_color: template.secondary_color,
          text_color: template.text_color,
          accent_color: template.accent_color,
          show_logo: template.show_logo,
          header_title: template.header_title,
          footer_text: template.footer_text,
          show_footer: template.show_footer,
          legal_mentions: template.legal_mentions,
          payment_terms: template.payment_terms,
          bank_details: template.bank_details,
          vat_number: template.vat_number,
          is_active: template.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", template.id);

      if (error) throw error;

      setOriginalTemplate(template);
      setHasChanges(false);

      toast({
        title: "Template sauvegardé !",
        description: "Le template de facture a été mis à jour avec succès.",
      });
    } catch (err) {
      console.error("Error saving template:", err);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder le template",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Render invoice preview
  const renderPreview = () => {
    if (!template) return null;

    const escapeHtml = (str: string) => str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    return (
      <div 
        style={{ 
          backgroundColor: "#0a0a0a", 
          padding: "20px",
          borderRadius: "8px",
          maxHeight: "600px",
          overflowY: "auto"
        }}
      >
        <div
          style={{
            maxWidth: "600px",
            margin: "0 auto",
            backgroundColor: template.secondary_color,
            borderRadius: "12px",
            padding: "30px",
            fontFamily: "Inter, Arial, sans-serif",
            color: template.text_color,
          }}
        >
          {/* Header */}
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "flex-start",
            marginBottom: "30px",
            borderBottom: `2px solid ${template.primary_color}`,
            paddingBottom: "15px"
          }}>
            <div>
              {template.show_logo && (
                <div style={{ 
                  fontSize: "24px", 
                  fontWeight: "700", 
                  color: template.primary_color,
                  marginBottom: "5px"
                }}>
                  {template.company_name || "MAKE MUSIC"} 🎵
                </div>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <h1 style={{ 
                margin: 0, 
                fontSize: "24px", 
                color: template.primary_color 
              }}>
                {template.header_title}
              </h1>
              <p style={{ margin: "5px 0 0", color: "#a1a1aa", fontSize: "12px" }}>
                N° {sampleInvoiceData.invoiceNumber}
              </p>
              <p style={{ margin: "2px 0 0", color: "#a1a1aa", fontSize: "12px" }}>
                Date : {sampleInvoiceData.date}
              </p>
              {sampleInvoiceData.dueDate && (
                <p style={{ margin: "2px 0 0", color: "#a1a1aa", fontSize: "12px" }}>
                  Échéance : {sampleInvoiceData.dueDate}
                </p>
              )}
            </div>
          </div>

          {/* Addresses */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "30px" }}>
            <div>
              <h3 style={{ 
                color: template.primary_color, 
                fontSize: "11px", 
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "1px"
              }}>
                Émetteur
              </h3>
              <p style={{ margin: "4px 0", fontSize: "13px", fontWeight: "600" }}>
                {template.company_name}
              </p>
              {template.company_address && (
                <p style={{ margin: "4px 0", fontSize: "12px", color: "#d4d4d8", whiteSpace: "pre-line" }}>
                  {template.company_address}
                </p>
              )}
              {template.company_email && (
                <p style={{ margin: "4px 0", fontSize: "12px", color: "#d4d4d8" }}>
                  📧 {template.company_email}
                </p>
              )}
              {template.company_phone && (
                <p style={{ margin: "4px 0", fontSize: "12px", color: "#d4d4d8" }}>
                  📞 {template.company_phone}
                </p>
              )}
              {template.vat_number && (
                <p style={{ margin: "4px 0", fontSize: "11px", color: "#71717a" }}>
                  TVA: {template.vat_number}
                </p>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <h3 style={{ 
                color: template.primary_color, 
                fontSize: "11px", 
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "1px"
              }}>
                Client
              </h3>
              <p style={{ margin: "4px 0", fontSize: "13px", fontWeight: "600" }}>
                {sampleInvoiceData.clientName}
              </p>
              <p style={{ margin: "4px 0", fontSize: "12px", color: "#d4d4d8" }}>
                {sampleInvoiceData.clientEmail}
              </p>
              <p style={{ margin: "4px 0", fontSize: "12px", color: "#d4d4d8", whiteSpace: "pre-line" }}>
                {sampleInvoiceData.clientAddress}
              </p>
            </div>
          </div>

          {/* Items table */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px" }}>
            <thead>
              <tr>
                <th style={{ 
                  background: template.primary_color, 
                  color: "#0a0a0a", 
                  padding: "10px", 
                  textAlign: "left",
                  fontSize: "12px",
                  fontWeight: "600"
                }}>
                  Description
                </th>
                <th style={{ 
                  background: template.primary_color, 
                  color: "#0a0a0a", 
                  padding: "10px", 
                  textAlign: "center",
                  fontSize: "12px",
                  fontWeight: "600"
                }}>
                  Qté
                </th>
                <th style={{ 
                  background: template.primary_color, 
                  color: "#0a0a0a", 
                  padding: "10px", 
                  textAlign: "right",
                  fontSize: "12px",
                  fontWeight: "600"
                }}>
                  P.U.
                </th>
                <th style={{ 
                  background: template.primary_color, 
                  color: "#0a0a0a", 
                  padding: "10px", 
                  textAlign: "right",
                  fontSize: "12px",
                  fontWeight: "600"
                }}>
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {sampleInvoiceData.items.map((item, i) => (
                <tr key={i}>
                  <td style={{ padding: "10px", borderBottom: "1px solid #333", fontSize: "12px" }}>
                    {item.description}
                  </td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #333", textAlign: "center", fontSize: "12px" }}>
                    {item.quantity}
                  </td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #333", textAlign: "right", fontSize: "12px" }}>
                    {item.unitPrice.toFixed(2)} €
                  </td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #333", textAlign: "right", fontSize: "12px" }}>
                    {item.total.toFixed(2)} €
                  </td>
                </tr>
              ))}
              <tr style={{ background: template.accent_color }}>
                <td colSpan={3} style={{ padding: "12px", textAlign: "right", fontWeight: "700", fontSize: "14px" }}>
                  TOTAL TTC
                </td>
                <td style={{ padding: "12px", textAlign: "right", fontWeight: "700", fontSize: "16px", color: template.primary_color }}>
                  {sampleInvoiceData.total.toFixed(2)} €
                </td>
              </tr>
            </tbody>
          </table>

          {/* Payment terms */}
          {template.payment_terms && (
            <div style={{ 
              background: template.accent_color, 
              padding: "12px", 
              borderRadius: "6px",
              marginBottom: "15px"
            }}>
              <p style={{ margin: 0, fontSize: "11px", color: "#a1a1aa" }}>
                <strong>Conditions de paiement:</strong> {template.payment_terms}
              </p>
            </div>
          )}

          {/* Bank details */}
          {template.bank_details && (
            <div style={{ 
              background: template.accent_color, 
              padding: "12px", 
              borderRadius: "6px",
              marginBottom: "15px"
            }}>
              <p style={{ margin: 0, fontSize: "11px", color: "#a1a1aa", whiteSpace: "pre-line" }}>
                <strong>Coordonnées bancaires:</strong><br/>
                {template.bank_details}
              </p>
            </div>
          )}

          {/* Legal mentions */}
          {template.legal_mentions && (
            <div style={{ marginBottom: "15px" }}>
              <p style={{ margin: 0, fontSize: "10px", color: "#71717a", whiteSpace: "pre-line" }}>
                {template.legal_mentions}
              </p>
            </div>
          )}

          {/* Footer */}
          {template.show_footer && template.footer_text && (
            <div style={{ 
              textAlign: "center", 
              marginTop: "20px",
              paddingTop: "15px",
              borderTop: "1px solid #333"
            }}>
              <p style={{ margin: 0, fontSize: "11px", color: "#71717a", whiteSpace: "pre-line" }}>
                {template.footer_text}
              </p>
            </div>
          )}
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
          <Receipt className="w-5 h-5 text-amber-500" />
          <span className="font-display text-lg text-foreground">TEMPLATE DE FACTURE</span>
          {hasChanges && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500 animate-pulse">
              Non sauvegardé
            </span>
          )}
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
          ) : template ? (
            <div className="grid lg:grid-cols-2 gap-6">
              {/* LEFT: Editor */}
              <div className="space-y-6">
                {/* Company Info Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" />
                    <Label className="text-sm font-medium text-foreground">Informations de l'entreprise</Label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Nom de l'entreprise</Label>
                      <Input
                        value={template.company_name || ""}
                        onChange={(e) => updateField("company_name", e.target.value)}
                        className="mt-1"
                        placeholder="Make Music Studio"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">N° TVA</Label>
                      <Input
                        value={template.vat_number || ""}
                        onChange={(e) => updateField("vat_number", e.target.value)}
                        className="mt-1"
                        placeholder="BE 0123.456.789"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Adresse</Label>
                    <Textarea
                      value={template.company_address || ""}
                      onChange={(e) => updateField("company_address", e.target.value)}
                      className="mt-1 min-h-[80px]"
                      placeholder="Rue du Sceptre 22&#10;1050 Ixelles, Bruxelles"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Email</Label>
                      <Input
                        value={template.company_email || ""}
                        onChange={(e) => updateField("company_email", e.target.value)}
                        className="mt-1"
                        placeholder="contact@example.com"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Téléphone</Label>
                      <Input
                        value={template.company_phone || ""}
                        onChange={(e) => updateField("company_phone", e.target.value)}
                        className="mt-1"
                        placeholder="+32 476 09 41 72"
                      />
                    </div>
                  </div>
                </div>

                {/* Colors Section */}
                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-primary" />
                    <Label className="text-sm font-medium text-foreground">Couleurs et style</Label>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Primaire</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="color"
                          value={template.primary_color}
                          onChange={(e) => updateField("primary_color", e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer"
                        />
                        <Input
                          value={template.primary_color}
                          onChange={(e) => updateField("primary_color", e.target.value)}
                          className="flex-1 text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Fond</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="color"
                          value={template.secondary_color}
                          onChange={(e) => updateField("secondary_color", e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer"
                        />
                        <Input
                          value={template.secondary_color}
                          onChange={(e) => updateField("secondary_color", e.target.value)}
                          className="flex-1 text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Texte</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="color"
                          value={template.text_color}
                          onChange={(e) => updateField("text_color", e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer"
                        />
                        <Input
                          value={template.text_color}
                          onChange={(e) => updateField("text_color", e.target.value)}
                          className="flex-1 text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Accent</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="color"
                          value={template.accent_color}
                          onChange={(e) => updateField("accent_color", e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer"
                        />
                        <Input
                          value={template.accent_color}
                          onChange={(e) => updateField("accent_color", e.target.value)}
                          className="flex-1 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Titre de la facture</Label>
                      <Input
                        value={template.header_title || ""}
                        onChange={(e) => updateField("header_title", e.target.value)}
                        className="mt-1"
                        placeholder="FACTURE"
                      />
                    </div>
                    <div className="flex items-center gap-4 pt-6">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={template.show_logo}
                          onCheckedChange={(v) => updateField("show_logo", v)}
                        />
                        <span className="text-xs text-muted-foreground">Logo</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={template.show_footer}
                          onCheckedChange={(v) => updateField("show_footer", v)}
                        />
                        <span className="text-xs text-muted-foreground">Footer</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Legal Section */}
                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <Label className="text-sm font-medium text-foreground">Informations légales</Label>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Conditions de paiement</Label>
                    <Input
                      value={template.payment_terms || ""}
                      onChange={(e) => updateField("payment_terms", e.target.value)}
                      className="mt-1"
                      placeholder="Paiement à réception de facture"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Coordonnées bancaires</Label>
                    <Textarea
                      value={template.bank_details || ""}
                      onChange={(e) => updateField("bank_details", e.target.value)}
                      className="mt-1 min-h-[60px]"
                      placeholder="IBAN: BE00 0000 0000 0000&#10;BIC: GEBABEBB"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Mentions légales</Label>
                    <Textarea
                      value={template.legal_mentions || ""}
                      onChange={(e) => updateField("legal_mentions", e.target.value)}
                      className="mt-1 min-h-[60px]"
                      placeholder="Mentions légales optionnelles..."
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Texte du footer</Label>
                    <Textarea
                      value={template.footer_text || ""}
                      onChange={(e) => updateField("footer_text", e.target.value)}
                      className="mt-1 min-h-[60px]"
                      placeholder="Make Music Studio - Studio d'enregistrement professionnel"
                    />
                  </div>
                </div>

                {/* Save Button */}
                {hasChanges && (
                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={handleSave}
                      disabled={saving}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Sauvegarder le template
                    </Button>
                  </div>
                )}
              </div>

              {/* RIGHT: Preview */}
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
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucun template de facture trouvé.</p>
              <p className="text-sm">Exécutez la migration SQL pour créer le template par défaut.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminInvoiceTemplates;
