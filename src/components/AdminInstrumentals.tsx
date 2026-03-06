import { useState, useEffect, useRef } from "react";
import { Plus, Edit, Trash2, Music, Eye, EyeOff, FolderSearch, Loader2, Play, Pause, Volume2, Layers, Sparkles, Wand2, X, GripVertical, RefreshCw, FileAudio, Upload, Image } from "lucide-react";
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
  stems_drive_url?: string;
  sort_order?: number;
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
  stems_drive_url: "",
};

const AdminInstrumentals = () => {
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
  const [generatingCover, setGeneratingCover] = useState(false);
  const [generatingTitle, setGeneratingTitle] = useState(false);
  const [suggestedTitles, setSuggestedTitles] = useState<string[]>([]);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);

  const fetchInstrumentals = async () => {
    const { data, error } = await supabase
      .from("instrumentals")
      .select("*")
      .order("sort_order", { ascending: true });

    if (!error && data) {
      setInstrumentals(data);
    }
    setLoading(false);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedItem(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (id !== draggedItem) {
      setDragOverItem(id);
    }
  };

  const handleDragEnd = async () => {
    if (!draggedItem || !dragOverItem || draggedItem === dragOverItem) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    const items = [...instrumentals];
    const draggedIndex = items.findIndex(i => i.id === draggedItem);
    const overIndex = items.findIndex(i => i.id === dragOverItem);

    if (draggedIndex === -1 || overIndex === -1) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    const [removed] = items.splice(draggedIndex, 1);
    items.splice(overIndex, 0, removed);
    setInstrumentals(items);
    setDraggedItem(null);
    setDragOverItem(null);

    try {
      for (let i = 0; i < items.length; i++) {
        await (supabase as any)
          .from("instrumentals")
          .update({ sort_order: i + 1 })
          .eq("id", items[i].id);
      }
      toast({ title: "Ordre mis à jour" });
    } catch (err) {
      toast({ title: "Erreur", description: "Impossible de sauvegarder l'ordre", variant: "destructive" });
      fetchInstrumentals();
    }
  };

  const scanGoogleDrive = async () => {
    setScanningDrive(true);
    try {
      const { data, error } = await supabase.functions.invoke("scan-drive-instrumentals");
      if (error) throw error;
      if (data?.files) {
        setDriveFiles(data.files);
        const parts: string[] = [];
        if (data.newFiles > 0) parts.push(`${data.newFiles} ajouté(s)`);
        if (data.deletedFiles?.length > 0) parts.push(`${data.deletedFiles.length} supprimé(s)`);
        if (data.stemsFoldersFound > 0) parts.push(`${data.stemsFoldersFound} dossiers stems`);
        toast({
          title: "🔄 Synchronisation terminée",
          description: parts.length > 0 ? parts.join(" • ") : "Aucun changement détecté.",
        });
        fetchInstrumentals();
      }
    } catch (err: any) {
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
      has_stems: file.hasStemsFolder || false,
      stems_folder_id: file.stemsFolderId || "",
    });
    setIsDialogOpen(true);
  };

  const playDriveFile = (fileId: string) => {
    if (playingDriveId === fileId) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingDriveId(null);
    } else {
      audioRef.current?.pause();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stream-instrumental?fileId=${fileId}`;
      audioRef.current = new Audio(url);
      audioRef.current.play().catch(() => toast({ title: "Erreur de lecture", variant: "destructive" }));
      audioRef.current.onended = () => setPlayingDriveId(null);
      setPlayingDriveId(fileId);
      setPlayingId(null);
    }
  };

  const playInstrumental = (instrumental: Instrumental) => {
    if (playingId === instrumental.id) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingId(null);
    } else {
      audioRef.current?.pause();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stream-instrumental?fileId=${instrumental.drive_file_id}`;
      audioRef.current = new Audio(url);
      audioRef.current.play().catch(() => toast({ title: "Erreur de lecture", variant: "destructive" }));
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
      cover_image_url: formData.cover_image_url || null,
      drive_file_id: formData.drive_file_id,
      is_active: formData.is_active,
      price_base: parseFloat(formData.price_base) || 100,
      price_stems: parseFloat(formData.price_stems) || 150,
      price_exclusive: parseFloat(formData.price_exclusive) || 500,
      has_stems: formData.has_stems,
      stems_folder_id: formData.stems_folder_id || null,
      stems_drive_url: formData.stems_drive_url || null,
    };

    const { error } = editingId
      ? await supabase.from("instrumentals").update(instrumentalData).eq("id", editingId)
      : await supabase.from("instrumentals").insert(instrumentalData);

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Succès", description: editingId ? "Instrumental mis à jour." : "Instrumental créé." });
    }

    setSaving(false);
    setIsDialogOpen(false);
    setEditingId(null);
    setFormData(defaultFormData);
    fetchInstrumentals();
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
      stems_drive_url: instrumental.stems_drive_url || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cet instrumental ?")) return;
    const { error } = await supabase.from("instrumentals").delete().eq("id", id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Succès", description: "Instrumental supprimé." });
      fetchInstrumentals();
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from("instrumentals").update({ is_active: !currentStatus }).eq("id", id);
    if (!error) {
      toast({ title: !currentStatus ? "Activé" : "Désactivé" });
      fetchInstrumentals();
    }
  };

  const generateCover = async () => {
    if (!formData.title && !formData.genre) {
      toast({ title: "Erreur", description: "Veuillez entrer un titre ou un genre", variant: "destructive" });
      return;
    }
    setGeneratingCover(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-cover", {
        body: { title: formData.title, genre: formData.genre, bpm: formData.bpm, key: formData.key },
      });
      if (error) throw error;
      if (data?.coverUrl) {
        setFormData({ ...formData, cover_image_url: data.coverUrl });
        toast({ title: "Cover générée !" });
      }
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingCover(false);
    }
  };

  const generateTitles = async () => {
    setGeneratingTitle(true);
    setSuggestedTitles([]);
    try {
      const { data, error } = await supabase.functions.invoke("generate-title", {
        body: { genre: formData.genre || "Hip-Hop", bpm: formData.bpm, key: formData.key, language: "en" },
      });
      if (error) throw error;
      if (data?.titles) {
        setSuggestedTitles(data.titles);
        toast({ title: "Titres générés !" });
      }
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingTitle(false);
    }
  };

  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast({ title: "Format non supporté", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Fichier trop volumineux", variant: "destructive" });
      return;
    }
    setUploadingCover(true);
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `cover-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('instrumental-covers').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('instrumental-covers').getPublicUrl(fileName);
      setFormData({ ...formData, cover_image_url: urlData.publicUrl });
      toast({ title: "Image uploadée !" });
    } catch (err: any) {
      toast({ title: "Erreur d'upload", description: err.message, variant: "destructive" });
    } finally {
      setUploadingCover(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
          <Button variant="outline" onClick={scanGoogleDrive} disabled={scanningDrive}>
            {scanningDrive ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FolderSearch className="h-4 w-4 mr-2" />}
            {scanningDrive ? "Scan..." : "Scanner Drive"}
          </Button>
          
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingId(null);
              setFormData(defaultFormData);
              setSuggestedTitles([]);
            }
          }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Ajouter</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? "Modifier l'instrumental" : "Nouvel instrumental"}</DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <Label>Titre *</Label>
                      <Button type="button" variant="outline" size="sm" onClick={generateTitles} disabled={generatingTitle} className="h-7 text-xs">
                        {generatingTitle ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Wand2 className="h-3 w-3 mr-1" />}
                        {generatingTitle ? "Génération..." : "Générer avec IA"}
                      </Button>
                    </div>
                    <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
                    {suggestedTitles.length > 0 && (
                      <div className="mt-2 p-2 bg-primary/10 rounded-lg border border-primary/30">
                        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-primary" />Cliquez pour sélectionner :
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {suggestedTitles.map((title, idx) => (
                            <Button key={idx} type="button" variant="secondary" size="sm" onClick={() => { setFormData({ ...formData, title }); setSuggestedTitles([]); }} className="h-7 text-xs">
                              {title}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="col-span-2">
                    <Label>Description</Label>
                    <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                  </div>
                  
                  <div>
                    <Label>Genre</Label>
                    <Input value={formData.genre} onChange={(e) => setFormData({ ...formData, genre: e.target.value })} placeholder="Hip-Hop, R&B, Pop..." />
                  </div>
                  
                  <div>
                    <Label>BPM</Label>
                    <Input type="number" value={formData.bpm} onChange={(e) => setFormData({ ...formData, bpm: e.target.value })} placeholder="120" />
                  </div>
                  
                  <div>
                    <Label>Tonalité</Label>
                    <Input value={formData.key} onChange={(e) => setFormData({ ...formData, key: e.target.value })} placeholder="Cm, F#m..." />
                  </div>
                  
                  <div className="col-span-2 p-4 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-lg border border-blue-500/30">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-foreground font-semibold flex items-center gap-2">
                        <FileAudio className="h-4 w-4 text-blue-500" />Fichier Audio (Google Drive) *
                      </Label>
                      {editingId && <Badge variant="outline" className="text-xs text-blue-500"><RefreshCw className="h-3 w-3 mr-1" />Remplacer</Badge>}
                    </div>
                    
                    {formData.drive_file_id && (
                      <div className="mb-3 p-3 bg-background/50 rounded-lg border border-border">
                        <div className="flex items-center gap-3">
                          <Button type="button" variant="ghost" size="icon" onClick={() => playDriveFile(formData.drive_file_id)}>
                            {playingDriveId === formData.drive_file_id ? <Pause className="h-4 w-4 text-primary" /> : <Play className="h-4 w-4" />}
                          </Button>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{formData.drive_file_name || "Fichier sélectionné"}</p>
                            <p className="text-xs text-muted-foreground">ID: {formData.drive_file_id.slice(0, 20)}...</p>
                          </div>
                          {formData.has_stems && <Badge variant="outline" className="text-xs text-green-500"><Layers className="h-3 w-3 mr-1" />Stems</Badge>}
                        </div>
                      </div>
                    )}

                    {driveFiles.length > 0 && (
                      <div className="max-h-40 overflow-y-auto space-y-1 border border-border/50 rounded-lg p-2">
                        {driveFiles.map((file) => (
                          <div key={file.id} onClick={() => setFormData({ ...formData, drive_file_id: file.id, drive_file_name: file.name, has_stems: file.hasStemsFolder || false, stems_folder_id: file.stemsFolderId || "" })}
                            className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-all ${formData.drive_file_id === file.id ? "bg-blue-500/20 border border-blue-500/50" : "hover:bg-background/70"}`}>
                            <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); playDriveFile(file.id); }} className="shrink-0 h-7 w-7">
                              {playingDriveId === file.id ? <Pause className="h-3 w-3 text-primary" /> : <Play className="h-3 w-3" />}
                            </Button>
                            <p className={`text-sm truncate flex-1 ${formData.drive_file_id === file.id ? "font-semibold text-blue-400" : ""}`}>{file.name}</p>
                            {file.hasStemsFolder && <Badge variant="outline" className="text-xs text-green-500"><Layers className="h-2 w-2 mr-1" />Stems</Badge>}
                            {formData.drive_file_id === file.id && <Badge className="bg-blue-500 text-white text-xs">✓</Badge>}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-3">
                      <Label className="text-xs text-muted-foreground mb-1 block">Ou entrez l'ID manuellement :</Label>
                      <Input value={formData.drive_file_id} onChange={(e) => setFormData({ ...formData, drive_file_id: e.target.value })} placeholder="ID du fichier Google Drive..." required className="bg-background/50 text-xs" />
                    </div>
                  </div>
                  
                  <div className="col-span-2 p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-500/30">
                    <Label className="text-foreground font-semibold flex items-center gap-2 mb-3">
                      <Image className="h-4 w-4 text-purple-500" />Cover Image
                    </Label>
                    
                    <div className="flex gap-2 mb-3">
                      <input type="file" ref={fileInputRef} accept="image/*" onChange={handleCoverUpload} className="hidden" />
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingCover}>
                        {uploadingCover ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
                        {uploadingCover ? "Upload..." : "Uploader"}
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={generateCover} disabled={generatingCover}>
                        {generatingCover ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Wand2 className="h-3 w-3 mr-1" />}
                        {generatingCover ? "Génération..." : "Générer avec IA"}
                      </Button>
                    </div>

                    <Input value={formData.cover_image_url} onChange={(e) => setFormData({ ...formData, cover_image_url: e.target.value })} placeholder="https://..." className="bg-background/50 mb-3" />

                    {formData.cover_image_url && (
                      <div className="flex items-start gap-4 p-3 bg-background/50 rounded-lg border border-border">
                        <div className="relative">
                          <img src={formData.cover_image_url} alt="Cover" className="w-24 h-24 rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect fill="%23333" width="96" height="96"/></svg>'; }} />
                          <Button type="button" variant="destructive" size="icon" onClick={() => setFormData({ ...formData, cover_image_url: '' })} className="absolute -top-2 -right-2 h-6 w-6 rounded-full">
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium mb-1">Aperçu</p>
                          <p className="text-xs text-muted-foreground truncate">{formData.cover_image_url.slice(0, 50)}...</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Section Stems Google Drive */}
                  <div className="col-span-2 p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg border border-green-500/30">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-foreground font-semibold flex items-center gap-2">
                        <Layers className="h-4 w-4 text-green-500" />Dossier Stems (Google Drive)
                      </Label>
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={formData.has_stems} 
                          onCheckedChange={(checked) => setFormData({ ...formData, has_stems: checked })} 
                        />
                        <Label className="text-xs">Stems disponibles</Label>
                      </div>
                    </div>
                    
                    {formData.has_stems && (
                      <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                          Collez le lien complet du sous-dossier Google Drive contenant les stems de cet instrumental.
                          Ce lien sera envoyé au client par email et affiché dans "Mes Achats".
                        </p>
                        <Input 
                          value={formData.stems_drive_url} 
                          onChange={(e) => setFormData({ ...formData, stems_drive_url: e.target.value })} 
                          placeholder="https://drive.google.com/drive/folders/..." 
                          className="bg-background/50"
                        />
                        {formData.stems_drive_url && (
                          <div className="mt-2 flex items-center gap-2">
                            <Badge variant="outline" className="text-xs text-green-500 border-green-500/50">
                              ✓ Lien configuré
                            </Badge>
                            <a href={formData.stems_drive_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                              Tester le lien
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {!formData.has_stems && (
                      <p className="text-xs text-muted-foreground">
                        Activez cette option si des stems sont disponibles pour cet instrumental.
                      </p>
                    )}
                  </div>

                  <div className="col-span-2 flex items-center gap-2">
                    <Switch checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
                    <Label>Visible sur le site</Label>
                  </div>
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                  <Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : editingId ? "Mettre à jour" : "Créer"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {newDriveFiles.length > 0 && (
        <div className="mb-6 p-4 bg-amber-500/10 rounded-lg border border-amber-500/30">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <FolderSearch className="h-4 w-4 text-amber-500" />Nouveaux fichiers ({newDriveFiles.length})
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {newDriveFiles.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-2 bg-background/50 rounded">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Button variant="ghost" size="icon" onClick={() => playDriveFile(file.id)}>
                    {playingDriveId === file.id ? <Pause className="h-4 w-4 text-primary" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">{new Date(file.createdTime).toLocaleDateString()}</p>
                      {file.hasStemsFolder && <Badge variant="outline" className="text-xs text-green-500"><Layers className="h-3 w-3 mr-1" />Stems</Badge>}
                    </div>
                  </div>
                </div>
                <Button size="sm" onClick={() => handleAddFromDrive(file)}><Plus className="h-3 w-3 mr-1" />Ajouter</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : instrumentals.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Aucun instrumental. Scannez Google Drive ou cliquez sur "Ajouter".</p>
      ) : (
        <div className="space-y-3">
          {instrumentals.map((instrumental, index) => {
            const driveFile = driveFiles.find(f => f.id === instrumental.drive_file_id);
            return (
              <div key={instrumental.id} draggable onDragStart={(e) => handleDragStart(e, instrumental.id)} onDragOver={(e) => handleDragOver(e, instrumental.id)} onDragEnd={handleDragEnd}
                className={`p-4 rounded-lg transition-all cursor-move ${instrumental.is_active ? "bg-green-500/10 border border-green-500/30" : "bg-muted/50 opacity-60"} ${draggedItem === instrumental.id ? "opacity-50 scale-95" : ""} ${dragOverItem === instrumental.id ? "border-2 border-primary" : ""}`}>
                <div className="flex items-center gap-4">
                  {/* Poignée de drag & drop bien visible */}
                  <div 
                    className="shrink-0 cursor-grab active:cursor-grabbing p-2 rounded-lg bg-primary/20 hover:bg-primary/30 transition-all"
                    title="Glissez pour réordonner"
                  >
                    <GripVertical className="h-5 w-5 text-primary" />
                  </div>
                  <div className="shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">{index + 1}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => playInstrumental(instrumental)}>
                    {playingId === instrumental.id ? <Pause className="h-5 w-5 text-primary" /> : <Play className="h-5 w-5" />}
                  </Button>

                  {instrumental.cover_image_url ? (
                    <img src={instrumental.cover_image_url} alt={instrumental.title} className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center"><Music className="h-5 w-5 text-primary/40" /></div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{instrumental.title}</h3>
                      {instrumental.has_stems && <Badge variant="outline" className="text-xs text-green-500"><Layers className="h-3 w-3 mr-1" />Stems</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{instrumental.genre && `${instrumental.genre} • `}{instrumental.bpm && `${instrumental.bpm} BPM`}</p>
                    <p className="text-xs text-primary/70 truncate flex items-center gap-1 mt-0.5"><Volume2 className="h-3 w-3" />{driveFile?.name || `ID: ${instrumental.drive_file_id.slice(0, 15)}...`}</p>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex flex-col items-center"><span className="text-muted-foreground">Base</span><span className="font-semibold">{instrumental.price_base}€</span></div>
                    {instrumental.has_stems && <div className="flex flex-col items-center"><span className="text-muted-foreground">Stems</span><span className="font-semibold text-green-500">{instrumental.price_stems}€</span></div>}
                    <div className="flex flex-col items-center"><span className="text-muted-foreground">Exclu</span><span className="font-semibold text-amber-500">{instrumental.price_exclusive}€</span></div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => toggleActive(instrumental.id, instrumental.is_active)} title={instrumental.is_active ? "Masquer" : "Afficher"}>
                      {instrumental.is_active ? <Eye className="h-4 w-4 text-green-500" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(instrumental)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(instrumental.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminInstrumentals;
