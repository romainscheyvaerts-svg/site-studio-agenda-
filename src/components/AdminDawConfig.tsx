import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const AdminDawConfig = () => {
  const { toast } = useToast();
  const [dawUrl, setDawUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      const { data, error } = await supabase
        .from("site_config")
        .select("*")
        .eq("config_key", "daw_url")
        .single();

      if (!error && data) {
        setDawUrl(data.config_value);
      }
      setLoading(false);
    };

    fetchConfig();
  }, []);

  const handleSave = async () => {
    if (!dawUrl.trim()) {
      toast({
        title: "Erreur",
        description: "L'URL du DAW ne peut pas être vide.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    
    const { error } = await supabase
      .from("site_config")
      .update({ config_value: dawUrl.trim() })
      .eq("config_key", "daw_url");

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder l'URL du DAW.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Succès",
        description: "L'URL du DAW a été mise à jour.",
      });
    }
    
    setSaving(false);
  };

  const openDaw = () => {
    window.open("/daw", "_blank");
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ExternalLink className="h-5 w-5 text-primary" />
          Configuration DAW Nova Studio
        </CardTitle>
        <CardDescription>
          Gérez l'URL du DAW externe intégré au site.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="daw-url">URL du DAW</Label>
          <Input
            id="daw-url"
            type="url"
            placeholder="https://..."
            value={dawUrl}
            onChange={(e) => setDawUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            L'URL sera intégrée dans un iframe sur la page /daw
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Sauvegarder
          </Button>
          <Button variant="outline" onClick={openDaw}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Tester le DAW
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminDawConfig;
