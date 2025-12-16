import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Music, Eye, EyeOff } from "lucide-react";
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

const defaultFormData = {
  title: "",
  description: "",
  genre: "",
  bpm: "",
  key: "",
  preview_url: "",
  cover_image_url: "",
  drive_file_id: "",
  is_active: true
};

const AdminInstrumentals = () => {
  const { toast } = useToast();
  const [instrumentals, setInstrumentals] = useState<Instrumental[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    fetchInstrumentals();
  }, []);

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
        toast({ title: "Succès", description: "Instrumental créé." });
      }
    }

    setSaving(false);
    setIsDialogOpen(false);
    setEditingId(null);
    setFormData(defaultFormData);
    fetchInstrumentals();
  };

  const handleEdit = (instrumental: Instrumental) => {
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
      fetchInstrumentals();
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Music className="h-5 w-5 text-primary" />
          Gestion des Instrumentaux
        </h2>
        
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
                  <Label>Actif (visible sur le site)</Label>
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

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : instrumentals.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          Aucun instrumental. Cliquez sur "Ajouter" pour en créer un.
        </p>
      ) : (
        <div className="space-y-3">
          {instrumentals.map((instrumental) => (
            <div 
              key={instrumental.id}
              className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg"
            >
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
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleActive(instrumental.id, instrumental.is_active)}
                  title={instrumental.is_active ? "Désactiver" : "Activer"}
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
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminInstrumentals;
