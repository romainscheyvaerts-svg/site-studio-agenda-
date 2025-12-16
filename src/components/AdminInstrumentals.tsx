import { useState, useEffect, useRef } from "react";
import { Plus, Edit, Trash2, Music, Eye, EyeOff, FolderSearch, Loader2, Euro, Play, Pause, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  size: string;
  isInDatabase: boolean;
  webContentLink?: string;
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
  is_active: false
};

const DEFAULT_PRICE = 100;

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
          description: `${data.newFiles} nouveau(x) fichier(s) trouvé(s) sur ${data.totalInDrive} au total.`
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
    // Auto-scan Drive pour récupérer les noms des fichiers
    scanGoogleDrive();
    
    // Cleanup audio on unmount
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleAddFromDrive = (file: DriveFile) => {
    // Extraire le titre du nom du fichier (sans extension)
    const titleWithoutExt = file.name.replace(/\.(mp3|wav|flac|m4a)$/i, "");
    
    setEditingId(null);
    setFormData({
      ...defaultFormData,
      title: titleWithoutExt,
      drive_file_id: file.id,
      drive_file_name: file.name,
      is_active: false
    });
    setIsDialogOpen(true);
  };

  // Play audio preview from Google Drive via proxy
  const playDriveFile = (fileId: string) => {
    if (playingDriveId === fileId) {
      // Stop playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingDriveId(null);
    } else {
      // Stop any current playback
      if (audioRef.current) {
        audioRef.current.pause();
      }
      // Use streaming proxy
      const previewUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stream-instrumental?fileId=${fileId}`;
      audioRef.current = new Audio(previewUrl);
      audioRef.current.play().catch(err => {
        console.error("Playback error:", err);
        toast({
          title: "Erreur de lecture",
          description: "Impossible de lire le fichier. Vérifiez les permissions du fichier Google Drive.",
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
      // Use streaming proxy for reliable playback
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
      is_active: formData.is_active
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
        toast({ title: "Succès", description: "Instrumental créé (prix par défaut: 100€)." });
      }
    }

    setSaving(false);
    setIsDialogOpen(false);
    setEditingId(null);
    setFormData(defaultFormData);
    fetchInstrumentals();
    // Rafraîchir les fichiers Drive pour mettre à jour le statut
    if (driveFiles.length > 0) {
      scanGoogleDrive();
    }
  };

  const handleEdit = (instrumental: Instrumental) => {
    // Trouver le nom du fichier Drive si disponible
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
      is_active: instrumental.is_active
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
          ? "L'instrumental est maintenant visible pour les utilisateurs." 
          : "L'instrumental est masqué."
      });
      fetchInstrumentals();
    }
  };

  // Fichiers Drive qui ne sont pas encore dans la base
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
                  <div className="col-span-2">
                    <Label>Titre *</Label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
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
                    <Label>ID Fichier Google Drive (HQ) *</Label>
                    <Input
                      value={formData.drive_file_id}
                      onChange={(e) => setFormData({ ...formData, drive_file_id: e.target.value })}
                      placeholder="1abc123..."
                      required
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <Label>URL Preview Audio (MP3)</Label>
                    <Input
                      value={formData.preview_url}
                      onChange={(e) => setFormData({ ...formData, preview_url: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <Label>URL Image de couverture</Label>
                    <Input
                      value={formData.cover_image_url}
                      onChange={(e) => setFormData({ ...formData, cover_image_url: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                  
                  <div className="col-span-2 flex items-center gap-2">
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                    <Label>Visible sur le site (activer pour afficher aux utilisateurs)</Label>
                  </div>
                  
                  <div className="col-span-2 p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Euro className="h-4 w-4" />
                      Prix par défaut: <strong className="text-foreground">{DEFAULT_PRICE}€</strong> (modifiable via les licences)
                    </p>
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
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(file.createdTime).toLocaleDateString()}
                    </p>
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
          Aucun instrumental. Scannez Google Drive ou cliquez sur "Ajouter" pour en créer un.
        </p>
      ) : (
        <div className="space-y-3">
          {instrumentals.map((instrumental) => {
            const driveFile = driveFiles.find(f => f.id === instrumental.drive_file_id);
            return (
            <div 
              key={instrumental.id}
              className={`flex items-center gap-4 p-4 rounded-lg transition-colors ${
                instrumental.is_active 
                  ? "bg-green-500/10 border border-green-500/30" 
                  : "bg-muted/50 opacity-60"
              }`}
            >
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
                <h3 className="font-semibold text-foreground truncate">{instrumental.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {instrumental.genre && `${instrumental.genre} • `}
                  {instrumental.bpm && `${instrumental.bpm} BPM`}
                </p>
                {/* Afficher le nom du fichier Drive */}
                <p className="text-xs text-primary/70 truncate flex items-center gap-1 mt-0.5">
                  <Volume2 className="h-3 w-3" />
                  {driveFile?.name || `ID: ${instrumental.drive_file_id.slice(0, 15)}...`}
                </p>
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
          )})}
        </div>
      )}
    </div>
  );
};

export default AdminInstrumentals;