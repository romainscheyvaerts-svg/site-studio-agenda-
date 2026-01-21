import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Save, Loader2, GripVertical, Languages } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

// Fonction de traduction côté client
const translateText = (text: string, targetLang: "en" | "nl" | "es"): string => {
  const lowerText = text.toLowerCase().trim();

  // Vérifier si le texte exact existe dans le dictionnaire
  if (TRANSLATION_DICTIONARY[lowerText]) {
    const translated = TRANSLATION_DICTIONARY[lowerText][targetLang];
    // Préserver la casse du premier caractère
    if (text[0] === text[0].toUpperCase()) {
      return translated.charAt(0).toUpperCase() + translated.slice(1);
    }
    return translated;
  }

  // Sinon, traduire mot par mot et reconstruire la phrase
  let result = text;

  // Trier les clés par longueur décroissante pour matcher les phrases plus longues d'abord
  const sortedKeys = Object.keys(TRANSLATION_DICTIONARY).sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    const regex = new RegExp(`\\b${key}\\b`, "gi");
    result = result.replace(regex, (match) => {
      const translation = TRANSLATION_DICTIONARY[key.toLowerCase()][targetLang];
      // Préserver la casse
      if (match[0] === match[0].toUpperCase()) {
        return translation.charAt(0).toUpperCase() + translation.slice(1);
      }
      return translation;
    });
  }

  return result;
};

// Dictionnaire de traductions pour les termes courants du studio
const TRANSLATION_DICTIONARY: Record<string, { en: string; nl: string; es: string }> = {
  // Termes généraux
  "inclus": { en: "included", nl: "inbegrepen", es: "incluido" },
  "incluse": { en: "included", nl: "inbegrepen", es: "incluida" },
  "non inclus": { en: "not included", nl: "niet inbegrepen", es: "no incluido" },
  "disponible": { en: "available", nl: "beschikbaar", es: "disponible" },
  "illimité": { en: "unlimited", nl: "onbeperkt", es: "ilimitado" },
  "illimitée": { en: "unlimited", nl: "onbeperkt", es: "ilimitada" },
  "gratuit": { en: "free", nl: "gratis", es: "gratis" },
  "sur demande": { en: "on request", nl: "op aanvraag", es: "bajo petición" },
  "par heure": { en: "per hour", nl: "per uur", es: "por hora" },
  "par jour": { en: "per day", nl: "per dag", es: "por día" },
  "par session": { en: "per session", nl: "per sessie", es: "por sesión" },
  "par titre": { en: "per track", nl: "per nummer", es: "por pista" },
  "par piste": { en: "per track", nl: "per spoor", es: "por pista" },

  // Équipement et technique
  "ingénieur du son": { en: "sound engineer", nl: "geluidstechnicus", es: "ingeniero de sonido" },
  "ingénieur son": { en: "sound engineer", nl: "geluidstechnicus", es: "ingeniero de sonido" },
  "microphone": { en: "microphone", nl: "microfoon", es: "micrófono" },
  "microphones": { en: "microphones", nl: "microfoons", es: "micrófonos" },
  "micro": { en: "microphone", nl: "microfoon", es: "micrófono" },
  "micros": { en: "microphones", nl: "microfoons", es: "micrófonos" },
  "casque": { en: "headphones", nl: "koptelefoon", es: "auriculares" },
  "casques": { en: "headphones", nl: "koptelefoons", es: "auriculares" },
  "enceintes": { en: "speakers", nl: "luidsprekers", es: "altavoces" },
  "moniteurs": { en: "monitors", nl: "monitors", es: "monitores" },
  "console": { en: "console", nl: "mengtafel", es: "consola" },
  "table de mixage": { en: "mixing console", nl: "mengtafel", es: "mesa de mezclas" },
  "préampli": { en: "preamp", nl: "voorversterker", es: "preamplificador" },
  "préamplificateur": { en: "preamplifier", nl: "voorversterker", es: "preamplificador" },
  "compresseur": { en: "compressor", nl: "compressor", es: "compresor" },
  "égaliseur": { en: "equalizer", nl: "equalizer", es: "ecualizador" },
  "eq": { en: "EQ", nl: "EQ", es: "EQ" },
  "réverbe": { en: "reverb", nl: "reverb", es: "reverberación" },
  "delay": { en: "delay", nl: "delay", es: "delay" },
  "effets": { en: "effects", nl: "effecten", es: "efectos" },
  "plugins": { en: "plugins", nl: "plugins", es: "plugins" },
  "analogique": { en: "analog", nl: "analoog", es: "analógico" },
  "numérique": { en: "digital", nl: "digitaal", es: "digital" },

  // Services et processus
  "enregistrement": { en: "recording", nl: "opname", es: "grabación" },
  "mixage": { en: "mixing", nl: "mixing", es: "mezcla" },
  "mastering": { en: "mastering", nl: "mastering", es: "masterización" },
  "production": { en: "production", nl: "productie", es: "producción" },
  "édition": { en: "editing", nl: "bewerking", es: "edición" },
  "montage": { en: "editing", nl: "montage", es: "montaje" },
  "arrangement": { en: "arrangement", nl: "arrangement", es: "arreglo" },
  "composition": { en: "composition", nl: "compositie", es: "composición" },
  "voix": { en: "vocals", nl: "zang", es: "voces" },
  "vocal": { en: "vocal", nl: "vocaal", es: "vocal" },
  "vocaux": { en: "vocals", nl: "zang", es: "vocales" },
  "instrument": { en: "instrument", nl: "instrument", es: "instrumento" },
  "instruments": { en: "instruments", nl: "instrumenten", es: "instrumentos" },
  "batterie": { en: "drums", nl: "drums", es: "batería" },
  "guitare": { en: "guitar", nl: "gitaar", es: "guitarra" },
  "basse": { en: "bass", nl: "bas", es: "bajo" },
  "piano": { en: "piano", nl: "piano", es: "piano" },
  "clavier": { en: "keyboard", nl: "keyboard", es: "teclado" },
  "synthétiseur": { en: "synthesizer", nl: "synthesizer", es: "sintetizador" },

  // Studio et espaces
  "studio": { en: "studio", nl: "studio", es: "estudio" },
  "cabine": { en: "booth", nl: "cabine", es: "cabina" },
  "régie": { en: "control room", nl: "regiekamer", es: "sala de control" },
  "salle": { en: "room", nl: "zaal", es: "sala" },
  "espace": { en: "space", nl: "ruimte", es: "espacio" },
  "isolation": { en: "isolation", nl: "isolatie", es: "aislamiento" },
  "acoustique": { en: "acoustic", nl: "akoestisch", es: "acústico" },
  "traitement acoustique": { en: "acoustic treatment", nl: "akoestische behandeling", es: "tratamiento acústico" },

  // Formats et livrables
  "format": { en: "format", nl: "formaat", es: "formato" },
  "fichier": { en: "file", nl: "bestand", es: "archivo" },
  "fichiers": { en: "files", nl: "bestanden", es: "archivos" },
  "wav": { en: "WAV", nl: "WAV", es: "WAV" },
  "mp3": { en: "MP3", nl: "MP3", es: "MP3" },
  "stems": { en: "stems", nl: "stems", es: "stems" },
  "pistes séparées": { en: "separate tracks", nl: "aparte sporen", es: "pistas separadas" },
  "export": { en: "export", nl: "export", es: "exportación" },
  "livraison": { en: "delivery", nl: "levering", es: "entrega" },
  "révision": { en: "revision", nl: "revisie", es: "revisión" },
  "révisions": { en: "revisions", nl: "revisies", es: "revisiones" },
  "modification": { en: "modification", nl: "wijziging", es: "modificación" },
  "modifications": { en: "modifications", nl: "wijzigingen", es: "modificaciones" },
  "retouche": { en: "touch-up", nl: "retouche", es: "retoque" },
  "retouches": { en: "touch-ups", nl: "retouches", es: "retoques" },

  // Temps et durée
  "heure": { en: "hour", nl: "uur", es: "hora" },
  "heures": { en: "hours", nl: "uren", es: "horas" },
  "jour": { en: "day", nl: "dag", es: "día" },
  "jours": { en: "days", nl: "dagen", es: "días" },
  "session": { en: "session", nl: "sessie", es: "sesión" },
  "sessions": { en: "sessions", nl: "sessies", es: "sesiones" },
  "durée": { en: "duration", nl: "duur", es: "duración" },
  "minute": { en: "minute", nl: "minuut", es: "minuto" },
  "minutes": { en: "minutes", nl: "minuten", es: "minutos" },

  // Actions et verbes
  "accès": { en: "access", nl: "toegang", es: "acceso" },
  "utilisation": { en: "use", nl: "gebruik", es: "uso" },
  "assistance": { en: "assistance", nl: "assistentie", es: "asistencia" },
  "accompagnement": { en: "support", nl: "begeleiding", es: "acompañamiento" },
  "conseil": { en: "advice", nl: "advies", es: "consejo" },
  "conseils": { en: "advice", nl: "advies", es: "consejos" },
  "support": { en: "support", nl: "ondersteuning", es: "soporte" },
  "technique": { en: "technical", nl: "technisch", es: "técnico" },

  // Podcast spécifique
  "podcast": { en: "podcast", nl: "podcast", es: "podcast" },
  "épisode": { en: "episode", nl: "aflevering", es: "episodio" },
  "épisodes": { en: "episodes", nl: "afleveringen", es: "episodios" },
  "intro": { en: "intro", nl: "intro", es: "intro" },
  "outro": { en: "outro", nl: "outro", es: "outro" },
  "jingle": { en: "jingle", nl: "jingle", es: "jingle" },
  "habillage sonore": { en: "sound branding", nl: "geluidsidentiteit", es: "diseño sonoro" },
  "invité": { en: "guest", nl: "gast", es: "invitado" },
  "invités": { en: "guests", nl: "gasten", es: "invitados" },

  // Phrases courantes complètes
  "accès au matériel professionnel": { en: "access to professional equipment", nl: "toegang tot professionele apparatuur", es: "acceso a equipamiento profesional" },
  "équipement haut de gamme": { en: "high-end equipment", nl: "hoogwaardige apparatuur", es: "equipamiento de alta gama" },
  "qualité professionnelle": { en: "professional quality", nl: "professionele kwaliteit", es: "calidad profesional" },
  "service personnalisé": { en: "personalized service", nl: "gepersonaliseerde service", es: "servicio personalizado" },
  "accompagnement personnalisé": { en: "personalized support", nl: "persoonlijke begeleiding", es: "acompañamiento personalizado" },
  "tarif dégressif": { en: "volume discount", nl: "staffelkorting", es: "tarifa decreciente" },
  "devis sur mesure": { en: "custom quote", nl: "offerte op maat", es: "presupuesto personalizado" },
  "consultation gratuite": { en: "free consultation", nl: "gratis consultatie", es: "consulta gratuita" },
  "satisfaction garantie": { en: "satisfaction guaranteed", nl: "tevredenheid gegarandeerd", es: "satisfacción garantizada" },
};

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

  // Translate a single feature to all languages (côté client)
  const translateFeature = async (featureId: string, featureText: string): Promise<boolean> => {
    try {
      // Traduire vers chaque langue
      const translatedEn = translateText(featureText, "en");
      const translatedNl = translateText(featureText, "nl");
      const translatedEs = translateText(featureText, "es");

      // Mettre à jour la base de données avec les traductions
      const { error } = await supabase
        .from("service_features")
        .update({
          feature_text_en: translatedEn,
          feature_text_nl: translatedNl,
          feature_text_es: translatedEs,
        })
        .eq("id", featureId);

      if (error) {
        console.error("Error saving translations:", error);
        return false;
      }

      return true;
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
