import { useState, useEffect } from "react";
import { Save, Loader2, FileText, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ContentRow {
  id: string;
  content_key: string;
  content_fr: string;
  content_en: string;
  content_es: string;
  content_nl: string;
  content_type: string;
  sort_order: number;
}

const LANGS = ["fr", "en", "es", "nl"] as const;
type Lang = (typeof LANGS)[number];

const LANG_LABELS: Record<Lang, string> = {
  fr: "Français",
  en: "English",
  es: "Español",
  nl: "Nederlands",
};

const GROUP_LABELS: Record<string, string> = {
  section: "En-tête section",
  card: "Cartes services",
  features: "Features (JSON)",
  payment: "Modalités paiement",
};

const AdminPricingContent = () => {
  const { toast } = useToast();
  const [content, setContent] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState<Record<string, Record<Lang, string>>>({});

  const fetchContent = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pricing_content")
      .select("*")
      .order("sort_order");

    if (!error && data) {
      setContent(data as ContentRow[]);
      // Initialize edited state
      const init: Record<string, Record<Lang, string>> = {};
      data.forEach((row: ContentRow) => {
        init[row.content_key] = {
          fr: row.content_fr,
          en: row.content_en,
          es: row.content_es,
          nl: row.content_nl,
        };
      });
      setEdited(init);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchContent();
  }, []);

  const handleChange = (key: string, lang: Lang, value: string) => {
    setEdited((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [lang]: value,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(edited).map(([key, langs]) => {
        const row = content.find((c) => c.content_key === key);
        if (!row) return null;
        return supabase
          .from("pricing_content")
          .update({
            content_fr: langs.fr,
            content_en: langs.en,
            content_es: langs.es,
            content_nl: langs.nl,
          })
          .eq("id", row.id);
      });

      await Promise.all(updates.filter(Boolean));

      toast({ title: "Succès", description: "Contenus mis à jour." });
      fetchContent();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  // Group content by prefix
  const groupedContent = content.reduce((acc, row) => {
    const prefix = row.content_key.split("_")[0];
    if (!acc[prefix]) acc[prefix] = [];
    acc[prefix].push(row);
    return acc;
  }, {} as Record<string, ContentRow[]>);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Contenu "Nos Offres" (multilingue)
          </h2>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Sauvegarder tout
          </Button>
        </div>

        <Tabs defaultValue="fr">
          <TabsList className="mb-4">
            {LANGS.map((lang) => (
              <TabsTrigger key={lang} value={lang} className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                {LANG_LABELS[lang]}
              </TabsTrigger>
            ))}
          </TabsList>

          {LANGS.map((lang) => (
            <TabsContent key={lang} value={lang} className="space-y-6">
              {Object.entries(groupedContent).map(([group, rows]) => (
                <div key={group} className="p-4 rounded-lg bg-muted/30 border border-border">
                  <h3 className="font-semibold text-foreground mb-4">{GROUP_LABELS[group] || group}</h3>
                  <div className="space-y-4">
                    {rows.map((row) => (
                      <div key={row.id} className="flex flex-col gap-1">
                        <Label className="text-xs text-muted-foreground">{row.content_key}</Label>
                        {row.content_type === "json" ? (
                          <Textarea
                            value={edited[row.content_key]?.[lang] || ""}
                            onChange={(e) => handleChange(row.content_key, lang, e.target.value)}
                            rows={3}
                            className="font-mono text-xs"
                            placeholder='["Feature 1", "Feature 2"]'
                          />
                        ) : row.content_key.includes("description") || row.content_key.includes("footer") ? (
                          <Textarea
                            value={edited[row.content_key]?.[lang] || ""}
                            onChange={(e) => handleChange(row.content_key, lang, e.target.value)}
                            rows={2}
                          />
                        ) : (
                          <Input
                            value={edited[row.content_key]?.[lang] || ""}
                            onChange={(e) => handleChange(row.content_key, lang, e.target.value)}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPricingContent;
