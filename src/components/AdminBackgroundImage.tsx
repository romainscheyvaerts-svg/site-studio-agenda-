import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Trash2, RotateCcw, Loader2, ImageIcon, Move, ZoomIn, ChevronDown } from "lucide-react";
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

// Pages disponibles pour les fonds personnalisés
const PAGES = [
  { id: "home", label: "Accueil", path: "/" },
  { id: "offres", label: "Offres", path: "/offres" },
  { id: "daw", label: "DAW Nova", path: "/daw" },
  { id: "reservation", label: "Réserver", path: "/reservation" },
  { id: "studio", label: "Découvrir le Studio", path: "/studio" },
  { id: "instrumentals", label: "Instrumentales", path: "/instrumentals" },
  { id: "arsenal", label: "Arsenal", path: "/arsenal" },
  { id: "gallery", label: "Galerie", path: "/gallery" },
  { id: "music", label: "Musique", path: "/music" },
] as const;

type PageId = typeof PAGES[number]["id"];

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
  const [selectedPage, setSelectedPage] = useState<PageId>("home");
  const [configs, setConfigs] = useState<Record<PageId, BackgroundConfig>>({} as Record<PageId, BackgroundConfig>);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [showCropEditor, setShowCropEditor] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const config = configs[selectedPage] || DEFAULT_CONFIG;

  useEffect(() => {
    fetchAllConfigs();
  }, []);

  const fetchAllConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from("site_config")
        .select("config_key, config_value")
        .like("config_key", "background_image_%");

      if (error) throw error;

      const loadedConfigs: Record<PageId, BackgroundConfig> = {} as Record<PageId, BackgroundConfig>;

      // Initialiser toutes les pages avec la config par défaut
      PAGES.forEach(page => {
        loadedConfigs[page.id] = { ...DEFAULT_CONFIG };
      });

      // Charger les configs existantes
      if (data) {
        data.forEach(item => {
          const pageId = item.config_key.replace("background_image_", "") as PageId;
          if (PAGES.some(p => p.id === pageId)) {
            loadedConfigs[pageId] = { ...DEFAULT_CONFIG, ...JSON.parse(item.config_value) };
          }
        });
      }

      // Aussi charger l'ancienne config globale pour "home" si elle existe
      const { data: oldConfig } = await supabase
        .from("site_config")
        .select("config_value")
        .eq("config_key", "background_image")
        .single();

      if (oldConfig && !loadedConfigs.home.imageUrl) {
        const parsed = JSON.parse(oldConfig.config_value);
        if (parsed.imageUrl) {
          loadedConfigs.home = { ...DEFAULT_CONFIG, ...parsed };
        }
      }

      setConfigs(loadedConfigs);
    } catch (err) {
      console.error("Error fetching background configs:", err);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (pageId: PageId, newConfig: BackgroundConfig) => {
    setSaving(true);
    try {
      const configKey = `background_image_${pageId}`;
      const pageName = PAGES.find(p => p.id === pageId)?.label || pageId;

      const { data: existing } = await supabase
        .from("site_config")
        .select("id")
        .eq("config_key", configKey)
        .single();

      if (existing) {
        const { error } = await supabase
          .from("site_config")
          .update({
            config_value: JSON.stringify(newConfig),
            updated_at: new Date().toISOString(),
          })
          .eq("config_key", configKey);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("site_config").insert({
          config_key: configKey,
          config_value: JSON.stringify(newConfig),
          description: `Image de fond - ${pageName}`,
        });

        if (error) throw error;
      }

      setConfigs(prev => ({ ...prev, [pageId]: newConfig }));
      toast({
        title: "Sauvegardé",
        description: `Configuration de ${pageName} mise à jour`,
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
      const croppedBlob = await getCroppedImg(imgRef.current, completedCrop);
      const fileName = `background_${selectedPage}_${Date.now()}.jpg`;

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

      const newConfig: BackgroundConfig = {
        ...config,
        enabled: true,
        imageUrl: urlData.publicUrl,
      };

      await saveConfig(selectedPage, newConfig);

      setShowCropEditor(false);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }

      toast({
        title: "Image de fond mise à jour",
        description: `L'image a été appliquée à la page ${PAGES.find(p => p.id === selectedPage)?.label}`,
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
    const newConfig: BackgroundConfig = { ...DEFAULT_CONFIG };
    await saveConfig(selectedPage, newConfig);
  };

  const handleToggleEnabled = async (enabled: boolean) => {
    const newConfig = { ...config, enabled };
    await saveConfig(selectedPage, newConfig);
  };

  const handleSliderChange = (key: keyof BackgroundConfig, value: number) => {
    setConfigs(prev => ({
      ...prev,
      [selectedPage]: { ...config, [key]: value }
    }));
  };

  const handleSliderCommit = async (key: keyof BackgroundConfig, value: number) => {
    const newConfig = { ...config, [key]: value };
    await saveConfig(selectedPage, newConfig);
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

  const selectedPageLabel = PAGES.find(p => p.id === selectedPage)?.label || "Page";
  const pagesWithBackground = PAGES.filter(p => configs[p.id]?.imageUrl);

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
            Recadrer l'image pour "{selectedPageLabel}"
          </h4>
          <p className="text-xs text-muted-foreground">Format 16:9</p>
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
      {/* Sélecteur de page */}
      <div className="flex items-center gap-3">
        <Label className="text-sm font-medium shrink-0">Page :</Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="flex-1 justify-between">
              <span className="flex items-center gap-2">
                {selectedPageLabel}
                {config.imageUrl && (
                  <span className="w-2 h-2 rounded-full bg-primary" />
                )}
              </span>
              <ChevronDown className="w-4 h-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[200px]">
            {PAGES.map((page) => (
              <DropdownMenuItem
                key={page.id}
                onClick={() => setSelectedPage(page.id)}
                className="flex items-center justify-between"
              >
                <span>{page.label}</span>
                {configs[page.id]?.imageUrl && (
                  <span className="w-2 h-2 rounded-full bg-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Indicateur des pages avec fond */}
      {pagesWithBackground.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-primary" />
            {pagesWithBackground.length} page{pagesWithBackground.length > 1 ? "s" : ""} avec fond personnalisé
          </span>
        </div>
      )}

      {/* Toggle activation */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border">
        <div>
          <Label className="text-sm font-medium">Image de fond - {selectedPageLabel}</Label>
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
              {selectedPageLabel}
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
              saveConfig(selectedPage, resetConfig);
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
