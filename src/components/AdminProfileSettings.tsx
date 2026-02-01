import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, User, Palette, Check } from "lucide-react";
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
  const [displayName, setDisplayName] = useState("");
  const [selectedColor, setSelectedColor] = useState("#00D9FF");

  useEffect(() => {
    if (user?.id) {
      fetchProfile();
    }
  }, [user?.id]);

  const fetchProfile = async () => {
    if (!user?.id) return;

    try {
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
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
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

      fetchProfile();
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
            {ADMIN_COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() => setSelectedColor(color.value)}
                className={cn(
                  "w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center",
                  selectedColor === color.value
                    ? "border-foreground scale-110"
                    : "border-transparent hover:scale-105"
                )}
                style={{ backgroundColor: color.value }}
                title={color.name}
              >
                {selectedColor === color.value && (
                  <Check className="w-5 h-5 text-white drop-shadow-lg" />
                )}
              </button>
            ))}
          </div>
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