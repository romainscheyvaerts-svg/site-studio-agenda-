import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Trash2, RotateCcw, Loader2, ImageIcon, Move, ZoomIn } from "lucide-react";
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

interface BackgroundConfig {
  enabled: boolean;
  imageUrl: string | null;
  opacity: number;
  blur: number;
  positionX: number;
  positionY: number;
  scale: number;
}

const DEFAULT_CONFIG: BackgroundConfig = {
  enabled: false,
  imageUrl: null,
  opacity: 30,
  blur: 0,
  positionX: 50,
  positionY: 50,
  scale: 100,
};

// Aspect ratio for typical desktop screens (16:9)
const ASPECT_RATIO = 16 / 9;

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: "%",
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

const AdminBackgroundImage = () => {
  const { toast } = useToast();
  const [config, setConfig] = useState<BackgroundConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [showCropEditor, setShowCropEditor] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("site_config")
        .select("config_key, config_value")
        .eq("config_key", "background_image");

      if (error) throw error;

      if (data && data.length > 0) {
        const savedConfig = JSON.parse(data[0].config_value);
        setConfig({ ...DEFAULT_CONFIG, ...savedConfig });
      }
    } catch (err) {
      console.error("Error fetching background config:", err);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (newConfig: BackgroundConfig) => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("site_config")
        .select("id")
        .eq("config_key", "background_image")
        .single();

      if (existing) {
        const { error } = await supabase
          .from("site_config")
          .update({
            config_value: JSON.stringify(newConfig),
            updated_at: new Date().toISOString(),
          })
          .eq("config_key", "background_image");

        if (error) throw error;
      } else {
        const { error } = await supabase.from("site_config").insert({
          config_key: "background_image",
          config_value: JSON.stringify(newConfig),
          description: "Configuration de l'image de fond du site",
        });

        if (error) throw error;
      }

      setConfig(newConfig);
      toast({
        title: "Sauvegardé",
        description: "La configuration a été mise à jour",
      });
    } catch (err) {
      console.error("Error saving config:", err);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder la configuration",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, ASPECT_RATIO));
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Créer une URL de prévisualisation
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setShowCropEditor(true);
  };

  const getCroppedImg = async (
    image: HTMLImageElement,
    crop: PixelCrop
  ): Promise<Blob> => {
    const canvas = document.createElement("canvas");
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // Taille de sortie pour une image de fond (Full HD)
    const outputWidth = 1920;
    const outputHeight = 1080;

    canvas.width = outputWidth;
    canvas.height = outputHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2d context");

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      outputWidth,
      outputHeight
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas is empty"));
        },
        "image/jpeg",
        0.9
      );
    });
  };

  const handleCropComplete = async () => {
    if (!imgRef.current || !completedCrop) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une zone à recadrer",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      // Générer l'image recadrée
      const croppedBlob = await getCroppedImg(imgRef.current, completedCrop);

      // Upload vers Supabase Storage
      const fileName = `background_${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("gallery")
        .upload(fileName, croppedBlob, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("gallery")
        .getPublicUrl(fileName);

      // Sauvegarder la nouvelle config
      const newConfig: BackgroundConfig = {
        ...config,
        enabled: true,
        imageUrl: urlData.publicUrl,
      };

      await saveConfig(newConfig);

      // Nettoyer
      setShowCropEditor(false);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }

      toast({
        title: "Image de fond mise à jour",
        description: "L'image a été recadrée et uploadée avec succès",
      });
    } catch (err) {
      console.error("Error uploading cropped image:", err);
      toast({
        title: "Erreur",
        description: "Impossible d'uploader l'image",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveBackground = async () => {
    const newConfig: BackgroundConfig = {
      ...DEFAULT_CONFIG,
    };
    await saveConfig(newConfig);
  };

  const handleToggleEnabled = async (enabled: boolean) => {
    const newConfig = { ...config, enabled };
    await saveConfig(newConfig);
  };

  const handleSliderChange = (key: keyof BackgroundConfig, value: number) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSliderCommit = async (key: keyof BackgroundConfig, value: number) => {
    const newConfig = { ...config, [key]: value };
    await saveConfig(newConfig);
  };

  const cancelCrop = () => {
    setShowCropEditor(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // Mode édition de recadrage
  if (showCropEditor && previewUrl) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium flex items-center gap-2">
            <Move className="w-4 h-4" />
            Recadrer l'image
          </h4>
          <p className="text-xs text-muted-foreground">Format 16:9 (écran large)</p>
        </div>

        <div className="border border-border rounded-lg overflow-hidden bg-black/50">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={ASPECT_RATIO}
            className="max-h-[400px]"
          >
            <img
              ref={imgRef}
              src={previewUrl}
              alt="Crop preview"
              onLoad={onImageLoad}
              className="max-h-[400px] w-auto mx-auto"
            />
          </ReactCrop>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Faites glisser pour ajuster la zone qui sera visible en arrière-plan
        </p>

        <div className="flex gap-2">
          <Button variant="outline" onClick={cancelCrop} className="flex-1">
            Annuler
          </Button>
          <Button
            onClick={handleCropComplete}
            disabled={uploading}
            className="flex-1"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Upload...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Appliquer
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toggle activation */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border">
        <div>
          <Label className="text-sm font-medium">Image de fond personnalisée</Label>
          <p className="text-xs text-muted-foreground mt-1">
            {config.imageUrl ? "Activez pour afficher votre image" : "Uploadez une image d'abord"}
          </p>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={handleToggleEnabled}
          disabled={!config.imageUrl || saving}
        />
      </div>

      {/* Prévisualisation de l'image actuelle */}
      {config.imageUrl && (
        <div className="relative rounded-lg overflow-hidden border border-border">
          <div
            className="h-40 bg-cover bg-center"
            style={{
              backgroundImage: `url(${config.imageUrl})`,
              backgroundPosition: `${config.positionX}% ${config.positionY}%`,
              filter: `blur(${config.blur}px)`,
              opacity: config.opacity / 100,
              transform: `scale(${config.scale / 100})`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
          <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end">
            <span className="text-xs text-muted-foreground bg-background/50 px-2 py-1 rounded">
              Prévisualisation
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRemoveBackground}
              disabled={saving}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Supprimer
            </Button>
          </div>
        </div>
      )}

      {/* Upload nouvelle image */}
      <div>
        <Label className="text-sm font-medium mb-2 block">
          {config.imageUrl ? "Changer l'image" : "Ajouter une image de fond"}
        </Label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          id="bg-upload"
        />
        <label
          htmlFor="bg-upload"
          className="flex items-center justify-center gap-2 p-6 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <ImageIcon className="w-6 h-6 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Cliquez pour sélectionner une image
          </span>
        </label>
      </div>

      {/* Contrôles d'ajustement */}
      {config.imageUrl && (
        <div className="space-y-4 p-4 rounded-lg bg-secondary/30 border border-border">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <ZoomIn className="w-4 h-4" />
            Ajustements
          </h4>

          {/* Opacité */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="text-xs">Opacité</Label>
              <span className="text-xs text-muted-foreground">{config.opacity}%</span>
            </div>
            <Slider
              value={[config.opacity]}
              min={5}
              max={100}
              step={5}
              onValueChange={([v]) => handleSliderChange("opacity", v)}
              onValueCommit={([v]) => handleSliderCommit("opacity", v)}
            />
          </div>

          {/* Flou */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="text-xs">Flou</Label>
              <span className="text-xs text-muted-foreground">{config.blur}px</span>
            </div>
            <Slider
              value={[config.blur]}
              min={0}
              max={20}
              step={1}
              onValueChange={([v]) => handleSliderChange("blur", v)}
              onValueCommit={([v]) => handleSliderCommit("blur", v)}
            />
          </div>

          {/* Position X */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="text-xs">Position horizontale</Label>
              <span className="text-xs text-muted-foreground">{config.positionX}%</span>
            </div>
            <Slider
              value={[config.positionX]}
              min={0}
              max={100}
              step={5}
              onValueChange={([v]) => handleSliderChange("positionX", v)}
              onValueCommit={([v]) => handleSliderCommit("positionX", v)}
            />
          </div>

          {/* Position Y */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="text-xs">Position verticale</Label>
              <span className="text-xs text-muted-foreground">{config.positionY}%</span>
            </div>
            <Slider
              value={[config.positionY]}
              min={0}
              max={100}
              step={5}
              onValueChange={([v]) => handleSliderChange("positionY", v)}
              onValueCommit={([v]) => handleSliderCommit("positionY", v)}
            />
          </div>

          {/* Échelle */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="text-xs">Échelle</Label>
              <span className="text-xs text-muted-foreground">{config.scale}%</span>
            </div>
            <Slider
              value={[config.scale]}
              min={100}
              max={150}
              step={5}
              onValueChange={([v]) => handleSliderChange("scale", v)}
              onValueCommit={([v]) => handleSliderCommit("scale", v)}
            />
          </div>

          {/* Reset */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const resetConfig = {
                ...config,
                opacity: 30,
                blur: 0,
                positionX: 50,
                positionY: 50,
                scale: 100,
              };
              saveConfig(resetConfig);
            }}
            className="w-full"
          >
            <RotateCcw className="w-3 h-3 mr-2" />
            Réinitialiser les ajustements
          </Button>
        </div>
      )}

      {saving && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Sauvegarde...
        </div>
      )}
    </div>
  );
};

export default AdminBackgroundImage;
