import { useState, useEffect } from "react";
import { Image, Plus, Trash2, GripVertical, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface GalleryPhoto {
  id: string;
  image_url: string;
  title: string | null;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

const AdminGallery = () => {
  const { toast } = useToast();
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchPhotos();
  }, []);

  const fetchPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from("gallery_photos")
        .select("*")
        .order("sort_order");

      if (error) throw error;
      setPhotos(data || []);
    } catch (err) {
      console.error("Error fetching gallery photos:", err);
      toast({
        title: "Erreur",
        description: "Impossible de charger les photos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("gallery")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("gallery")
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from("gallery_photos")
        .insert({
          image_url: urlData.publicUrl,
          title: file.name.replace(/\.[^/.]+$/, ""),
          sort_order: photos.length,
        });

      if (insertError) throw insertError;

      toast({
        title: "Photo ajoutée",
        description: "La photo a été ajoutée à la galerie",
      });

      fetchPhotos();
    } catch (err) {
      console.error("Error uploading photo:", err);
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter la photo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const togglePhoto = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("gallery_photos")
        .update({ is_active: !isActive })
        .eq("id", id);

      if (error) throw error;

      setPhotos(photos.map(p => 
        p.id === id ? { ...p, is_active: !isActive } : p
      ));

      toast({
        title: "Photo mise à jour",
        description: `Photo ${!isActive ? "activée" : "désactivée"}`,
      });
    } catch (err) {
      console.error("Error updating photo:", err);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour la photo",
        variant: "destructive",
      });
    }
  };

  const deletePhoto = async (id: string, imageUrl: string) => {
    if (!confirm("Supprimer cette photo ?")) return;

    try {
      // Extract filename from URL
      const fileName = imageUrl.split("/").pop();
      
      if (fileName) {
        await supabase.storage.from("gallery").remove([fileName]);
      }

      const { error } = await supabase
        .from("gallery_photos")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setPhotos(photos.filter(p => p.id !== id));

      toast({
        title: "Photo supprimée",
        description: "La photo a été supprimée de la galerie",
      });
    } catch (err) {
      console.error("Error deleting photo:", err);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la photo",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <Image className="w-4 h-4" />
        Galerie Studio
      </h3>

      {/* Upload button */}
      <div className="flex items-center gap-4">
        <Label
          htmlFor="gallery-upload"
          className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/30 rounded-lg cursor-pointer hover:bg-primary/20 transition-colors"
        >
          <Upload className="w-4 h-4" />
          {uploading ? "Upload en cours..." : "Ajouter une photo"}
        </Label>
        <Input
          id="gallery-upload"
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          disabled={uploading}
          className="hidden"
        />
      </div>

      {/* Photos list */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          Chargement...
        </div>
      ) : photos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Aucune photo dans la galerie
        </div>
      ) : (
        <div className="space-y-2">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${
                photo.is_active
                  ? "bg-primary/5 border-primary/30"
                  : "bg-muted/30 border-border opacity-60"
              }`}
            >
              <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
              
              <img
                src={photo.image_url}
                alt={photo.title || "Photo galerie"}
                className="w-16 h-12 object-cover rounded"
              />
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {photo.title || "Sans titre"}
                </p>
              </div>

              <Switch
                checked={photo.is_active}
                onCheckedChange={() => togglePhoto(photo.id, photo.is_active)}
              />

              <Button
                variant="ghost"
                size="icon"
                onClick={() => deletePhoto(photo.id, photo.image_url)}
                className="text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminGallery;
