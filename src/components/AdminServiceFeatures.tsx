import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Save, Loader2, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ServiceFeature {
  id: string;
  service_key: string;
  feature_text: string;
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
  const [features, setFeatures] = useState<ServiceFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update existing features
      for (const [id, text] of Object.entries(editedFeatures)) {
        const { error } = await supabase
          .from("service_features")
          .update({ feature_text: text })
          .eq("id", id);
        if (error) throw error;
      }

      toast({
        title: "Sauvegardé !",
        description: "Les caractéristiques ont été mises à jour.",
      });
      
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
    }
  };

  const handleAddFeature = async (serviceKey: string) => {
    const text = newFeatures[serviceKey]?.trim();
    if (!text) return;

    try {
      const maxOrder = features
        .filter(f => f.service_key === serviceKey)
        .reduce((max, f) => Math.max(max, f.sort_order), 0);

      const { error } = await supabase
        .from("service_features")
        .insert({
          service_key: serviceKey,
          feature_text: text,
          sort_order: maxOrder + 1,
        });

      if (error) throw error;

      toast({
        title: "Ajouté !",
        description: "La caractéristique a été ajoutée.",
      });

      setNewFeatures(prev => ({ ...prev, [serviceKey]: "" }));
      fetchFeatures();
    } catch (error) {
      console.error("Error adding feature:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter la caractéristique.",
        variant: "destructive",
      });
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
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Caractéristiques des Services</h3>
        {hasChanges && (
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Sauvegarder
          </Button>
        )}
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
