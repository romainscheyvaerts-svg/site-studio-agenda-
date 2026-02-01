import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, User, Palette, Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const ADMIN_COLORS = [
  { value: "#00D9FF", name: "Cyan" },
  { value: "#FF6B6B", name: "Rouge" },
  { value: "#4ECDC4", name: "Turquoise" },
  { value: "#FFE66D", name: "Jaune" },
  { value: "#95E1D3", name: "Menthe" },
  { value: "#F38181", name: "Corail" },
  { value: "#AA96DA", name: "Violet" },
  { value: "#FCBAD3", name: "Rose" },
  { value: "#A8D8EA", name: "Bleu clair" },
  { value: "#FF9F45", name: "Orange" },
];

interface AdminProfile {
  id: string;
  user_id: string;
  display_name: string;
  color: string;
}

const AdminProfileSettings = () => {
  const { user } = useAdmin();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [allProfiles, setAllProfiles] = useState<AdminProfile[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [selectedColor, setSelectedColor] = useState("#00D9FF");

  useEffect(() => {
    if (user?.id) {
      fetchAllProfiles();
    }
  }, [user?.id]);

  const fetchAllProfiles = async () => {
    if (!user?.id) return;

    try {
      // Fetch ALL admin profiles to see which colors are taken
      const { data: allData, error: allError } = await supabase
        .from("admin_profiles" as any)
        .select("*");

      if (!allError && allData) {
        setAllProfiles(allData as unknown as AdminProfile[]);
      }

      // Fetch current user's profile
      const { data, error } = await supabase
        .from("admin_profiles" as any)
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching profile:", error);
      }

      if (data) {
        const profileData = data as unknown as AdminProfile;
        setProfile(profileData);
        setDisplayName(profileData.display_name);
        setSelectedColor(profileData.color);
      } else {
        // Set default values from user email
        const defaultName = user.email?.split("@")[0] || "Admin";
        setDisplayName(defaultName.charAt(0).toUpperCase() + defaultName.slice(1));
        // Find first available color
        const takenColors = (allData as unknown as AdminProfile[] || []).map(p => p.color);
        const firstAvailable = ADMIN_COLORS.find(c => !takenColors.includes(c.value));
        if (firstAvailable) {
          setSelectedColor(firstAvailable.value);
        }
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Check if a color is taken by another admin
  const isColorTaken = (colorValue: string) => {
    return allProfiles.some(p => p.color === colorValue && p.user_id !== user?.id);
  };

  // Get the admin name who has this color
  const getColorOwner = (colorValue: string) => {
    const owner = allProfiles.find(p => p.color === colorValue && p.user_id !== user?.id);
    return owner?.display_name || null;
  };

  const handleSave = async () => {
    if (!user?.id || !displayName.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer un nom d'affichage",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      if (profile) {
        // Update existing profile
        const { error } = await supabase
          .from("admin_profiles" as any)
          .update({
            display_name: displayName.trim(),
            color: selectedColor,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        // Insert new profile
        const { error } = await supabase
          .from("admin_profiles" as any)
          .insert({
            user_id: user.id,
            display_name: displayName.trim(),
            color: selectedColor,
          });

        if (error) throw error;
      }

      toast({
        title: "Profil enregistré ! ✅",
        description: "Votre profil admin a été mis à jour",
      });

      fetchAllProfiles();
    } catch (err) {
      console.error("Error saving profile:", err);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder le profil",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="bg-card border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <User className="w-5 h-5 text-primary" />
          Mon profil Admin
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Display Name */}
        <div className="space-y-2">
          <Label htmlFor="display-name">Nom d'affichage</Label>
          <p className="text-xs text-muted-foreground">
            Ce nom apparaîtra sur les événements que vous créez ou dont vous êtes responsable
          </p>
          <Input
            id="display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Ex: Romain, Kazam..."
            className="bg-background"
          />
        </div>

        {/* Color Picker */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Couleur d'identification
          </Label>
          <p className="text-xs text-muted-foreground">
            Cette couleur permettra d'identifier vos sessions sur le calendrier
          </p>
          <div className="flex flex-wrap gap-2">
            {ADMIN_COLORS.map((color) => {
              const taken = isColorTaken(color.value);
              const owner = getColorOwner(color.value);
              const isSelected = selectedColor === color.value;
              
              return (
                <button
                  key={color.value}
                  onClick={() => !taken && setSelectedColor(color.value)}
                  disabled={taken}
                  className={cn(
                    "w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center relative",
                    isSelected
                      ? "border-foreground scale-110"
                      : taken
                        ? "border-transparent opacity-50 cursor-not-allowed"
                        : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: color.value }}
                  title={taken ? `${color.name} - Utilisé par ${owner}` : color.name}
                >
                  {isSelected && (
                    <Check className="w-5 h-5 text-white drop-shadow-lg" />
                  )}
                  {taken && !isSelected && (
                    <Lock className="w-4 h-4 text-white/80 drop-shadow-lg" />
                  )}
                </button>
              );
            })}
          </div>
          {/* Show taken colors info */}
          {allProfiles.filter(p => p.user_id !== user?.id).length > 0 && (
            <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border/50">
              <p className="text-xs text-muted-foreground mb-2">Couleurs des autres admins :</p>
              <div className="flex flex-wrap gap-2">
                {allProfiles.filter(p => p.user_id !== user?.id).map(p => (
                  <div key={p.user_id} className="flex items-center gap-1.5 text-xs">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="text-muted-foreground">{p.display_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="p-4 rounded-lg bg-secondary/30 border border-border">
          <Label className="text-xs text-muted-foreground">Aperçu sur le calendrier</Label>
          <div className="mt-2 flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: selectedColor }}
            />
            <span className="font-medium text-foreground">{displayName || "Nom"}</span>
            <span className="text-sm text-muted-foreground">- Session client</span>
          </div>
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={saving || !displayName.trim()}
          className="w-full"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Enregistrer le profil
        </Button>
      </CardContent>
    </Card>
  );
};

export default AdminProfileSettings;