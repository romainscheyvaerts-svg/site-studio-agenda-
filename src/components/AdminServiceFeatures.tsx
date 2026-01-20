import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Save, Loader2, GripVertical, Languages } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ServiceFeature {
  id: string;
  service_key: string;
  feature_text: string;
  feature_text_en?: string;
  feature_text_nl?: string;
  feature_text_es?: string;
  sort_order: number;
  is_active: boolean;
}

const SERVICE_LABELS: Record<string, string> = {
  "with-engineer": "Session avec Ingénieur",
  "without-engineer": "Location Sèche",
  "mixing": "Mixage",
  "mastering": "Mastering",
  "analog-mastering": "Mastering Analogique",
  "podcast": "Podcast",
};

const AdminServiceFeatures = () => {
  const { toast } = useToast();
  const { session } = useAuth();
  const [features, setFeatures] = useState<ServiceFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [editedFeatures, setEditedFeatures] = useState<Record<string, string>>({});
  const [newFeatures, setNewFeatures] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchFeatures();
  }, []);

  const fetchFeatures = async () => {
    try {
      const { data, error } = await supabase
        .from("service_features")
        .select("*")
        .order("service_key")
        .order("sort_order");

      if (error) throw error;
      setFeatures(data || []);
    } catch (error) {
      console.error("Error fetching features:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les caractéristiques.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFeatureChange = (id: string, value: string) => {
    setEditedFeatures(prev => ({ ...prev, [id]: value }));
  };

  // Translate a single feature to all languages
  const translateFeature = async (featureId: string, featureText: string): Promise<boolean> => {
    if (!session?.access_token) return false;

    try {
      const { error } = await supabase.functions.invoke("translate-text", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { featureId, featureText },
      });

      return !error;
    } catch (error) {
      console.error("Translation error:", error);
      return false;
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update existing features and trigger translations
      const translationPromises: Promise<boolean>[] = [];

      for (const [id, text] of Object.entries(editedFeatures)) {
        // First update the French text
        const { error } = await supabase
          .from("service_features")
          .update({ feature_text: text })
          .eq("id", id);
        if (error) throw error;

        // Queue translation
        translationPromises.push(translateFeature(id, text));
      }

      toast({
        title: "Sauvegardé !",
        description: "Les caractéristiques ont été mises à jour. Traduction en cours...",
      });

      // Run translations in background
      setTranslating(true);
      const results = await Promise.all(translationPromises);
      const successCount = results.filter(Boolean).length;

      if (successCount > 0) {
        toast({
          title: "Traductions terminées",
          description: `${successCount}/${results.length} caractéristique(s) traduite(s) en EN, NL, ES.`,
        });
      }

      setEditedFeatures({});
      fetchFeatures();
    } catch (error) {
      console.error("Error saving features:", error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder les modifications.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
      setTranslating(false);
    }
  };

  const handleAddFeature = async (serviceKey: string) => {
    const text = newFeatures[serviceKey]?.trim();
    if (!text) return;

    try {
      const maxOrder = features
        .filter(f => f.service_key === serviceKey)
        .reduce((max, f) => Math.max(max, f.sort_order), 0);

      const { data, error } = await supabase
        .from("service_features")
        .insert({
          service_key: serviceKey,
          feature_text: text,
          sort_order: maxOrder + 1,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Ajouté !",
        description: "La caractéristique a été ajoutée. Traduction en cours...",
      });

      setNewFeatures(prev => ({ ...prev, [serviceKey]: "" }));

      // Trigger translation for the new feature
      if (data?.id) {
        translateFeature(data.id, text).then((success) => {
          if (success) {
            toast({
              title: "Traduction terminée",
              description: "Caractéristique traduite en EN, NL, ES.",
            });
          }
          fetchFeatures();
        });
      } else {
        fetchFeatures();
      }
    } catch (error) {
      console.error("Error adding feature:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter la caractéristique.",
        variant: "destructive",
      });
    }
  };

  // Translate all features that don't have translations yet
  const handleTranslateAll = async () => {
    // Find features without translations
    const featuresToTranslate = features.filter(
      f => !f.feature_text_en || !f.feature_text_nl || !f.feature_text_es
    );

    if (featuresToTranslate.length === 0) {
      toast({
        title: "Déjà traduit",
        description: "Toutes les caractéristiques ont déjà des traductions.",
      });
      return;
    }

    setTranslating(true);
    toast({
      title: "Traduction en cours...",
      description: `${featuresToTranslate.length} caractéristique(s) à traduire.`,
    });

    try {
      let successCount = 0;
      for (const feature of featuresToTranslate) {
        const success = await translateFeature(feature.id, feature.feature_text);
        if (success) successCount++;
      }

      toast({
        title: "Traductions terminées",
        description: `${successCount}/${featuresToTranslate.length} caractéristique(s) traduite(s).`,
      });

      fetchFeatures();
    } catch (error) {
      console.error("Error translating all:", error);
      toast({
        title: "Erreur",
        description: "Erreur lors de la traduction.",
        variant: "destructive",
      });
    } finally {
      setTranslating(false);
    }
  };

  const handleDeleteFeature = async (id: string) => {
    try {
      const { error } = await supabase
        .from("service_features")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Supprimé !",
        description: "La caractéristique a été supprimée.",
      });

      fetchFeatures();
    } catch (error) {
      console.error("Error deleting feature:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la caractéristique.",
        variant: "destructive",
      });
    }
  };

  const groupedFeatures = features.reduce((acc, feature) => {
    if (!acc[feature.service_key]) {
      acc[feature.service_key] = [];
    }
    acc[feature.service_key].push(feature);
    return acc;
  }, {} as Record<string, ServiceFeature[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const hasChanges = Object.keys(editedFeatures).length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Caractéristiques des Services</h3>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Languages className="w-3 h-3" />
            Auto-traduction EN/NL/ES
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTranslateAll}
            disabled={translating || saving}
          >
            {translating ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Languages className="w-4 h-4 mr-2" />
            )}
            Traduire tout
          </Button>
          {hasChanges && (
            <Button onClick={handleSave} disabled={saving || translating}>
              {saving || translating ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {translating ? "Traduction..." : "Sauvegarder"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(SERVICE_LABELS).map(([serviceKey, label]) => (
          <Card key={serviceKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(groupedFeatures[serviceKey] || []).map((feature) => (
                <div key={feature.id} className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    value={editedFeatures[feature.id] ?? feature.feature_text}
                    onChange={(e) => handleFeatureChange(feature.id, e.target.value)}
                    className="flex-1 text-sm h-8"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteFeature(feature.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              
              {/* Add new feature */}
              <div className="flex items-center gap-2 pt-2 border-t border-border mt-2">
                <Input
                  placeholder="Nouvelle caractéristique..."
                  value={newFeatures[serviceKey] || ""}
                  onChange={(e) => setNewFeatures(prev => ({ ...prev, [serviceKey]: e.target.value }))}
                  className="flex-1 text-sm h-8"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAddFeature(serviceKey);
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleAddFeature(serviceKey)}
                  disabled={!newFeatures[serviceKey]?.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminServiceFeatures;
