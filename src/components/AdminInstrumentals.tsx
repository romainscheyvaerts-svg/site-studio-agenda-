import { useState, useEffect, useRef } from "react";
import { Plus, Edit, Trash2, Music, Eye, EyeOff, FolderSearch, Loader2, Euro, Play, Pause, Volume2, Layers, Save, Sparkles, Image, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface Instrumental {
  id: string;
  title: string;
  description?: string;
  genre?: string;
  bpm?: number;
  key?: string;
  preview_url?: string;
  cover_image_url?: string;
  drive_file_id: string;
  is_active: boolean;
  price_base?: number;
  price_stems?: number;
  price_exclusive?: number;
  has_stems?: boolean;
  stems_folder_id?: string;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  size: string;
  isInDatabase: boolean;
  webContentLink?: string;
  hasStemsFolder?: boolean;
  stemsFolderId?: string;
  stemsFolderName?: string;
}

const defaultFormData = {
  title: "",
  description: "",
  genre: "",
  bpm: "",
  key: "",
  preview_url: "",
  cover_image_url: "",
  drive_file_id: "",
  drive_file_name: "",
  is_active: false,
  price_base: "100",
  price_stems: "150",
  price_exclusive: "500",
  has_stems: false,
  stems_folder_id: "",
};

const AdminInstrumentals = () => {
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [instrumentals, setInstrumentals] = useState<Instrumental[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanningDrive, setScanningDrive] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingDriveId, setPlayingDriveId] = useState<string | null>(null);
  const [savingPrices, setSavingPrices] = useState<Record<string, boolean>>({});
  const [generatingCover, setGeneratingCover] = useState(false);
  const [generatingTitle, setGeneratingTitle] = useState(false);
  const [suggestedTitles, setSuggestedTitles] = useState<string[]>([]);

  const fetchInstrumentals = async () => {
    const { data, error } = await supabase
      .from("instrumentals")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setInstrumentals(data);
    }
    setLoading(false);
  };

  const scanGoogleDrive = async () => {
    setScanningDrive(true);
    try {
      const { data, error } = await supabase.functions.invoke("scan-drive-instrumentals");
      
      if (error) throw error;
      
      if (data.files) {
        setDriveFiles(data.files);
        toast({
          title: "Scan terminé",
          description: `${data.newFiles} nouveau(x) fichier(s), ${data.stemsFoldersFound || 0} dossier(s) stems trouvé(s).`
        });
      }
    } catch (err: any) {
      console.error("Drive scan error:", err);
      toast({
        title: "Erreur de scan",
        description: err.message || "Impossible de scanner Google Drive",
        variant: "destructive"
      });
    } finally {
      setScanningDrive(false);
    }
  };

  useEffect(() => {
    fetchInstrumentals();
    scanGoogleDrive();
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleAddFromDrive = (file: DriveFile) => {
    const titleWithoutExt = file.name.replace(/\.(mp3|wav|flac|m4a)$/i, "");
    
    setEditingId(null);
    setFormData({
      ...defaultFormData,
      title: titleWithoutExt,
      drive_file_id: file.id,
      drive_file_name: file.name,
      is_active: false,
      has_stems: file.hasStemsFolder || false,
      stems_folder_id: file.stemsFolderId || "",
    });
    setIsDialogOpen(true);
  };

  const playDriveFile = (fileId: string) => {
    if (playingDriveId === fileId) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingDriveId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const previewUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stream-instrumental?fileId=${fileId}`;
      audioRef.current = new Audio(previewUrl);
      audioRef.current.play().catch(err => {
        console.error("Playback error:", err);
        toast({
          title: "Erreur de lecture",
          description: "Impossible de lire le fichier.",
          variant: "destructive"
        });
      });
      audioRef.current.onended = () => setPlayingDriveId(null);
      setPlayingDriveId(fileId);
      setPlayingId(null);
    }
  };

  const playInstrumental = (instrumental: Instrumental) => {
    const fileId = instrumental.drive_file_id;
    if (playingId === instrumental.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stream-instrumental?fileId=${fileId}`;
      audioRef.current = new Audio(url);
      audioRef.current.play().catch(err => {
        console.error("Playback error:", err);
        toast({
          title: "Erreur de lecture",
          description: "Impossible de lire le fichier.",
          variant: "destructive"
        });
      });
      audioRef.current.onended = () => setPlayingId(null);
      setPlayingId(instrumental.id);
      setPlayingDriveId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const instrumentalData = {
      title: formData.title,
      description: formData.description || null,
      genre: formData.genre || null,
      bpm: formData.bpm ? parseInt(formData.bpm) : null,
      key: formData.key || null,
      preview_url: formData.preview_url || null,
      cover_image_url: formData.cover_image_url || null,
      drive_file_id: formData.drive_file_id,
      is_active: formData.is_active,
      price_base: parseFloat(formData.price_base) || 100,
      price_stems: parseFloat(formData.price_stems) || 150,
      price_exclusive: parseFloat(formData.price_exclusive) || 500,
      has_stems: formData.has_stems,
      stems_folder_id: formData.stems_folder_id || null,
    };

    if (editingId) {
      const { error } = await supabase
        .from("instrumentals")
        .update(instrumentalData)
        .eq("id", editingId);

      if (error) {
        toast({ title: "Erreur", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Succès", description: "Instrumental mis à jour." });
      }
    } else {
      const { error } = await supabase
        .from("instrumentals")
        .insert(instrumentalData);

      if (error) {
        toast({ title: "Erreur", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Succès", description: "Instrumental créé." });
      }
    }

    setSaving(false);
    setIsDialogOpen(false);
    setEditingId(null);
    setFormData(defaultFormData);
    fetchInstrumentals();
    if (driveFiles.length > 0) {
      scanGoogleDrive();
    }
  };

  const handleEdit = (instrumental: Instrumental) => {
    const driveFile = driveFiles.find(f => f.id === instrumental.drive_file_id);
    
    setEditingId(instrumental.id);
    setFormData({
      title: instrumental.title,
      description: instrumental.description || "",
      genre: instrumental.genre || "",
      bpm: instrumental.bpm?.toString() || "",
      key: instrumental.key || "",
      preview_url: instrumental.preview_url || "",
      cover_image_url: instrumental.cover_image_url || "",
      drive_file_id: instrumental.drive_file_id,
      drive_file_name: driveFile?.name || "",
      is_active: instrumental.is_active,
      price_base: instrumental.price_base?.toString() || "100",
      price_stems: instrumental.price_stems?.toString() || "150",
      price_exclusive: instrumental.price_exclusive?.toString() || "500",
      has_stems: instrumental.has_stems || false,
      stems_folder_id: instrumental.stems_folder_id || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cet instrumental ?")) return;

    const { error } = await supabase
      .from("instrumentals")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Succès", description: "Instrumental supprimé." });
      fetchInstrumentals();
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("instrumentals")
      .update({ is_active: !currentStatus })
      .eq("id", id);

    if (!error) {
      toast({
        title: !currentStatus ? "Activé" : "Désactivé",
        description: !currentStatus 
          ? "L'instrumental est maintenant visible." 
          : "L'instrumental est masqué."
      });
      fetchInstrumentals();
    }
  };

  const updatePrice = async (id: string, field: 'price_base' | 'price_stems' | 'price_exclusive', value: number) => {
    setSavingPrices(prev => ({ ...prev, [id]: true }));
    
    const { error } = await supabase
      .from("instrumentals")
      .update({ [field]: value })
      .eq("id", id);

    if (!error) {
      toast({ title: "Prix mis à jour" });
      fetchInstrumentals();
    } else {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
    
    setSavingPrices(prev => ({ ...prev, [id]: false }));
  };

  // Generate cover image with AI
  const generateCover = async () => {
    if (!formData.title && !formData.genre) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer un titre ou un genre pour générer la cover",
        variant: "destructive"
      });
      return;
    }

    setGeneratingCover(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-cover", {
        body: {
          title: formData.title,
          genre: formData.genre,
          bpm: formData.bpm,
          key: formData.key,
        },
      });

      if (error) throw error;

      if (data?.coverUrl) {
        setFormData({ ...formData, cover_image_url: data.coverUrl });
        toast({
          title: "Cover générée !",
          description: "L'image a été sauvegardée dans Supabase Storage",
        });
      }
    } catch (err: any) {
      console.error("Cover generation error:", err);
      toast({
        title: "Erreur",
        description: err.message || "Impossible de générer la cover",
        variant: "destructive"
      });
    } finally {
      setGeneratingCover(false);
    }
  };

  // Generate title suggestions with AI
  const generateTitles = async () => {
    setGeneratingTitle(true);
    setSuggestedTitles([]);
    try {
      const { data, error } = await supabase.functions.invoke("generate-title", {
        body: {
          genre: formData.genre || "Hip-Hop",
          bpm: formData.bpm,
          key: formData.key,
          language: "en",
        },
      });

      if (error) throw error;

      if (data?.titles && data.titles.length > 0) {
        setSuggestedTitles(data.titles);
        toast({
          title: "Titres générés !",
          description: `${data.titles.length} suggestions disponibles`,
        });
      }
    } catch (err: any) {
      console.error("Title generation error:", err);
      toast({
        title: "Erreur",
        description: err.message || "Impossible de générer les titres",
        variant: "destructive"
      });
    } finally {
      setGeneratingTitle(false);
    }
  };

  const selectTitle = (title: string) => {
    setFormData({ ...formData, title });
    setSuggestedTitles([]);
  };

  const newDriveFiles = driveFiles.filter(f => !f.isInDatabase);

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Music className="h-5 w-5 text-primary" />
          Gestion des Instrumentaux
        </h2>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={scanGoogleDrive}
            disabled={scanningDrive}
          >
            {scanningDrive ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Scan...
              </>
            ) : (
              <>
                <FolderSearch className="h-4 w-4 mr-2" />
                Scanner Drive
              </>
            )}
          </Button>
          
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingId(null);
              setFormData(defaultFormData);
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingId ? "Modifier l'instrumental" : "Nouvel instrumental"}
                </DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Titre avec génération IA */}
                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <Label>Titre *</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={generateTitles}
                        disabled={generatingTitle}
                        className="h-7 text-xs"
                      >
                        {generatingTitle ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Génération...
                          </>
                        ) : (
                          <>
                            <Wand2 className="h-3 w-3 mr-1" />
                            Générer avec IA
                          </>
                        )}
                      </Button>
                    </div>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                    {/* Suggested titles */}
                    {suggestedTitles.length > 0 && (
                      <div className="mt-2 p-2 bg-primary/10 rounded-lg border border-primary/30">
                        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-primary" />
                          Cliquez pour sélectionner :
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {suggestedTitles.map((title, idx) => (
                            <Button
                              key={idx}
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => selectTitle(title)}
                              className="h-7 text-xs"
                            >
                              {title}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="col-span-2">
                    <Label>Description</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                  
                  <div>
                    <Label>Genre</Label>
                    <Input
                      value={formData.genre}
                      onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                      placeholder="Hip-Hop, R&B, Pop..."
                    />
                  </div>
                  
                  <div>
                    <Label>BPM</Label>
                    <Input
                      type="number"
                      value={formData.bpm}
                      onChange={(e) => setFormData({ ...formData, bpm: e.target.value })}
                      placeholder="120"
                    />
                  </div>
                  
                  <div>
                    <Label>Tonalité</Label>
                    <Input
                      value={formData.key}
                      onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                      placeholder="Cm, F#m..."
                    />
                  </div>
                  
                  <div>
                    <Label>ID Fichier Google Drive *</Label>
                    <Input
                      value={formData.drive_file_id}
                      onChange={(e) => setFormData({ ...formData, drive_file_id: e.target.value })}
                      placeholder="1abc123..."
                      required
                    />
                  </div>
                  
                  {/* Prix personnalisés */}
                  <div className="col-span-2 p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg border border-green-500/30">
                    <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Euro className="h-4 w-4 text-green-500" />
                      Prix personnalisés
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label className="text-xs">Prix Base (€)</Label>
                        <Input
                          type="number"
                          value={formData.price_base}
                          onChange={(e) => setFormData({ ...formData, price_base: e.target.value })}
                          min="0"
                        />
                      </div>
                      <div>
                        <Label className="text-xs flex items-center gap-1">
                          Prix Stems (€)
                          {formData.has_stems && <Badge variant="outline" className="text-xs">Disponible</Badge>}
                        </Label>
                        <Input
                          type="number"
                          value={formData.price_stems}
                          onChange={(e) => setFormData({ ...formData, price_stems: e.target.value })}
                          min="0"
                          disabled={!formData.has_stems}
                          className={!formData.has_stems ? "opacity-50" : ""}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Prix Exclusive (€)</Label>
                        <Input
                          type="number"
                          value={formData.price_exclusive}
                          onChange={(e) => setFormData({ ...formData, price_exclusive: e.target.value })}
                          min="0"
                        />
                      </div>
                    </div>
                    {formData.has_stems && (
                      <p className="text-xs text-green-500 mt-2 flex items-center gap-1">
                        <Layers className="h-3 w-3" />
                        Dossier stems détecté: {formData.stems_folder_id?.slice(0, 15)}...
                      </p>
                    )}
                  </div>
                  
                  {/* Cover image avec génération IA */}
                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <Label>Image de couverture</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={generateCover}
                        disabled={generatingCover}
                        className="h-7 text-xs"
                      >
                        {generatingCover ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Génération...
                          </>
                        ) : (
                          <>
                            <Image className="h-3 w-3 mr-1" />
                            Générer cover IA
                          </>
                        )}
                      </Button>
                    </div>
                    <Input
                      value={formData.cover_image_url}
                      onChange={(e) => setFormData({ ...formData, cover_image_url: e.target.value })}
                      placeholder="https://... ou générez avec l'IA"
                    />
                    {/* Preview de la cover */}
                    {formData.cover_image_url && (
                      <div className="mt-2 flex items-center gap-3">
                        <img
                          src={formData.cover_image_url}
                          alt="Cover preview"
                          className="w-20 h-20 rounded-lg object-cover border border-border"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <p className="text-xs text-muted-foreground">
                          Aperçu de la cover
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="col-span-2 flex items-center gap-2">
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                    <Label>Visible sur le site</Label>
                  </div>
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Enregistrement..." : editingId ? "Mettre à jour" : "Créer"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Nouveaux fichiers Drive */}
      {newDriveFiles.length > 0 && (
        <div className="mb-6 p-4 bg-neon-gold/10 rounded-lg border border-neon-gold/30">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <FolderSearch className="h-4 w-4 text-neon-gold" />
            Nouveaux fichiers dans Google Drive ({newDriveFiles.length})
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {newDriveFiles.map((file) => (
              <div 
                key={file.id}
                className="flex items-center justify-between p-2 bg-background/50 rounded"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => playDriveFile(file.id)}
                    className="shrink-0"
                  >
                    {playingDriveId === file.id ? (
                      <Pause className="h-4 w-4 text-primary" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        {new Date(file.createdTime).toLocaleDateString()}
                      </p>
                      {file.hasStemsFolder && (
                        <Badge variant="outline" className="text-xs text-green-500 border-green-500/50">
                          <Layers className="h-3 w-3 mr-1" />
                          Stems
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => handleAddFromDrive(file)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Ajouter
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : instrumentals.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          Aucun instrumental. Scannez Google Drive ou cliquez sur "Ajouter".
        </p>
      ) : (
        <div className="space-y-3">
          {instrumentals.map((instrumental) => {
            const driveFile = driveFiles.find(f => f.id === instrumental.drive_file_id);
            return (
            <div 
              key={instrumental.id}
              className={`p-4 rounded-lg transition-colors ${
                instrumental.is_active 
                  ? "bg-green-500/10 border border-green-500/30" 
                  : "bg-muted/50 opacity-60"
              }`}
            >
              <div className="flex items-center gap-4">
                {/* Play Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => playInstrumental(instrumental)}
                  className="shrink-0"
                >
                  {playingId === instrumental.id ? (
                    <Pause className="h-5 w-5 text-primary" />
                  ) : (
                    <Play className="h-5 w-5" />
                  )}
                </Button>

                {instrumental.cover_image_url ? (
                  <img 
                    src={instrumental.cover_image_url} 
                    alt={instrumental.title}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Music className="h-5 w-5 text-primary/40" />
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground truncate">{instrumental.title}</h3>
                    {instrumental.has_stems && (
                      <Badge variant="outline" className="text-xs text-green-500 border-green-500/50">
                        <Layers className="h-3 w-3 mr-1" />
                        Stems
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {instrumental.genre && `${instrumental.genre} • `}
                    {instrumental.bpm && `${instrumental.bpm} BPM`}
                  </p>
                  <p className="text-xs text-primary/70 truncate flex items-center gap-1 mt-0.5">
                    <Volume2 className="h-3 w-3" />
                    {driveFile?.name || `ID: ${instrumental.drive_file_id.slice(0, 15)}...`}
                  </p>
                </div>
                
                {/* Prix inline */}
                <div className="flex items-center gap-2 text-xs">
                  <div className="flex flex-col items-center">
                    <span className="text-muted-foreground">Base</span>
                    <span className="font-semibold text-foreground">{instrumental.price_base}€</span>
                  </div>
                  {instrumental.has_stems && (
                    <div className="flex flex-col items-center">
                      <span className="text-muted-foreground">Stems</span>
                      <span className="font-semibold text-green-500">{instrumental.price_stems}€</span>
                    </div>
                  )}
                  <div className="flex flex-col items-center">
                    <span className="text-muted-foreground">Exclu</span>
                    <span className="font-semibold text-amber-500">{instrumental.price_exclusive}€</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleActive(instrumental.id, instrumental.is_active)}
                    title={instrumental.is_active ? "Masquer" : "Afficher"}
                  >
                    {instrumental.is_active ? (
                      <Eye className="h-4 w-4 text-green-500" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(instrumental)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(instrumental.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          )})}
        </div>
      )}
    </div>
  );
};

export default AdminInstrumentals;
