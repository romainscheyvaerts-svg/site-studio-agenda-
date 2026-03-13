import { useState, useEffect } from "react";
import { Plus, Trash2, Save, GripVertical, ExternalLink, Instagram, Music2, Youtube, Facebook, Twitter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SocialLink {
  id: string;
  platform: string;
  url: string;
  display_name: string;
  icon_name: string;
  sort_order: number;
  is_active: boolean;
}

const PLATFORMS = [
  { value: "instagram", label: "Instagram", icon: "Instagram" },
  { value: "tiktok", label: "TikTok", icon: "Music2" },
  { value: "youtube", label: "YouTube", icon: "Youtube" },
  { value: "facebook", label: "Facebook", icon: "Facebook" },
  { value: "twitter", label: "Twitter/X", icon: "Twitter" },
  { value: "spotify", label: "Spotify", icon: "Music" },
  { value: "soundcloud", label: "SoundCloud", icon: "Cloud" },
  { value: "other", label: "Autre", icon: "Link" },
];

const getIcon = (platform: string) => {
  switch (platform) {
    case "instagram": return <Instagram className="h-5 w-5" />;
    case "tiktok": return <Music2 className="h-5 w-5" />;
    case "youtube": return <Youtube className="h-5 w-5" />;
    case "facebook": return <Facebook className="h-5 w-5" />;
    case "twitter": return <Twitter className="h-5 w-5" />;
    default: return <ExternalLink className="h-5 w-5" />;
  }
};

const SortableItem = ({ link, onUpdate, onDelete }: { 
  link: SocialLink; 
  onUpdate: (id: string, field: keyof SocialLink, value: any) => void;
  onDelete: (id: string) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: link.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-card/50 border border-border rounded-lg p-4 flex items-center gap-4"
    >
      <div {...attributes} {...listeners} className="cursor-grab hover:text-primary">
        <GripVertical className="h-5 w-5" />
      </div>

      <div className="flex items-center gap-2 text-primary">
        {getIcon(link.platform)}
      </div>

      <Select
        value={link.platform}
        onValueChange={(value) => {
          const platform = PLATFORMS.find(p => p.value === value);
          onUpdate(link.id, "platform", value);
          if (platform) {
            onUpdate(link.id, "icon_name", platform.icon);
          }
        }}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PLATFORMS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        placeholder="@username"
        value={link.display_name || ""}
        onChange={(e) => onUpdate(link.id, "display_name", e.target.value)}
        className="w-[150px]"
      />

      <Input
        placeholder="https://..."
        value={link.url}
        onChange={(e) => onUpdate(link.id, "url", e.target.value)}
        className="flex-1"
      />

      <div className="flex items-center gap-2">
        <Switch
          checked={link.is_active}
          onCheckedChange={(checked) => onUpdate(link.id, "is_active", checked)}
        />
        <span className="text-xs text-muted-foreground">
          {link.is_active ? "Actif" : "Inactif"}
        </span>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => window.open(link.url, "_blank")}
        className="text-muted-foreground hover:text-primary"
      >
        <ExternalLink className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDelete(link.id)}
        className="text-muted-foreground hover:text-red-500"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};

const AdminSocialLinks = () => {
  const [links, setLinks] = useState<SocialLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    fetchLinks();
  }, []);

  const fetchLinks = async () => {
    const { data, error } = await supabase
      .from("social_links")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Error fetching social links:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les réseaux sociaux",
        variant: "destructive",
      });
    } else {
      setLinks(data || []);
    }
    setLoading(false);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = links.findIndex((l) => l.id === active.id);
    const newIndex = links.findIndex((l) => l.id === over.id);

    const newLinks = arrayMove(links, oldIndex, newIndex).map((link, index) => ({
      ...link,
      sort_order: index + 1,
    }));

    setLinks(newLinks);
    setHasChanges(true);
  };

  const handleUpdate = (id: string, field: keyof SocialLink, value: any) => {
    setLinks((prev) =>
      prev.map((link) =>
        link.id === id ? { ...link, [field]: value } : link
      )
    );
    setHasChanges(true);
  };

  const handleDelete = (id: string) => {
    setLinks((prev) => prev.filter((link) => link.id !== id));
    setHasChanges(true);
  };

  const handleAdd = () => {
    const newLink: SocialLink = {
      id: `temp-${Date.now()}`,
      platform: "instagram",
      url: "",
      display_name: "",
      icon_name: "Instagram",
      sort_order: links.length + 1,
      is_active: true,
    };
    setLinks((prev) => [...prev, newLink]);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Supprimer les liens existants
      await supabase.from("social_links").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      // Insérer les nouveaux liens
      const linksToInsert = links.map((link, index) => ({
        platform: link.platform,
        url: link.url,
        display_name: link.display_name,
        icon_name: link.icon_name,
        sort_order: index + 1,
        is_active: link.is_active,
      }));

      if (linksToInsert.length > 0) {
        const { error } = await supabase.from("social_links").insert(linksToInsert);
        if (error) throw error;
      }

      toast({
        title: "Sauvegardé !",
        description: "Les réseaux sociaux ont été mis à jour",
      });
      setHasChanges(false);
      fetchLinks();
    } catch (error) {
      console.error("Error saving social links:", error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder les réseaux sociaux",
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Réseaux Sociaux</h3>
          <p className="text-sm text-muted-foreground">
            Gérez les liens vers vos réseaux sociaux affichés sur le site
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleAdd} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            size="sm"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Sauvegarde..." : "Sauvegarder"}
          </Button>
        </div>
      </div>

      {links.length === 0 ? (
        <div className="text-center py-12 bg-card/50 rounded-lg border border-dashed border-border">
          <ExternalLink className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-foreground mb-2">
            Aucun réseau social
          </h4>
          <p className="text-muted-foreground mb-4">
            Ajoutez vos liens TikTok, Instagram, YouTube, etc.
          </p>
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un réseau
          </Button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={links.map((l) => l.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {links.map((link) => (
                <SortableItem
                  key={link.id}
                  link={link}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {hasChanges && (
        <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg flex items-center gap-3">
          <span>Modifications non sauvegardées</span>
          <Button size="sm" variant="secondary" onClick={handleSave} disabled={saving}>
            {saving ? "Sauvegarde..." : "Sauvegarder"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default AdminSocialLinks;
