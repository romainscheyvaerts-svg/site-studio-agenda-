import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mic, Euro, Headphones, Music } from "lucide-react";
import { useTranslation } from "react-i18next";

const DawNova = () => {
  const navigate = useNavigate();
  const [dawUrl, setDawUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNav, setShowNav] = useState(true);
  const { t } = useTranslation();

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

    // Hide nav after 3 seconds
    const timer = setTimeout(() => setShowNav(false), 3000);

    return () => {
      document.body.style.overflow = 'auto';
      clearTimeout(timer);
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
          <h1 className="text-2xl font-bold text-foreground mb-2">{t("daw.not_available")}</h1>
          <p className="text-muted-foreground">{t("daw.not_configured")}</p>
          <Button onClick={() => navigate('/')} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("daw.back_home")}
          </Button>
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
