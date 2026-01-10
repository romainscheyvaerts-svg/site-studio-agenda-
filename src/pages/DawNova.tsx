import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const DawNova = () => {
  const [dawUrl, setDawUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    
    const fetchDawUrl = async () => {
      const { data, error } = await supabase
        .from("site_config")
        .select("config_value")
        .eq("config_key", "daw_url")
        .single();
      
      if (!error && data) {
        setDawUrl(data.config_value);
      }
      setLoading(false);
    };

    fetchDawUrl();

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 w-full h-full bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!dawUrl) {
    return (
      <div className="fixed inset-0 w-full h-full bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">DAW non disponible</h1>
          <p className="text-muted-foreground">Le DAW n'est pas configuré pour le moment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full h-full bg-background">
      <iframe
        src={dawUrl}
        className="w-full h-full border-0"
        style={{
          border: 'none',
          margin: 0,
          padding: 0,
          overflow: 'hidden',
        }}
        allow="autoplay; microphone; fullscreen"
        title="DAW Nova Studio by MakeMusic"
      />
    </div>
  );
};

export default DawNova;
