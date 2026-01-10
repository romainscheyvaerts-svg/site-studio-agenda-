import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mic, Euro, Headphones, Music } from "lucide-react";

const DawNova = () => {
  const navigate = useNavigate();
  const [dawUrl, setDawUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNav, setShowNav] = useState(true);

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
          <h1 className="text-2xl font-bold text-foreground mb-2">DAW non disponible</h1>
          <p className="text-muted-foreground">Le DAW n'est pas configuré pour le moment.</p>
          <Button onClick={() => navigate('/')} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à l'accueil
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full h-full bg-background">
      {/* Floating navigation */}
      <div 
        className={`fixed top-2 left-2 z-50 flex items-center gap-1 bg-background/90 backdrop-blur-sm rounded-lg p-1.5 border border-border shadow-lg transition-opacity duration-300 ${showNav ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}
        onMouseEnter={() => setShowNav(true)}
      >
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => navigate('/')}
          className="h-7 px-2 text-xs gap-1"
        >
          <ArrowLeft className="w-3 h-3" />
        </Button>
        <div className="h-4 w-px bg-border" />
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => navigate('/reservation')}
          className="h-7 px-2 text-xs gap-1 text-primary border-primary/50"
        >
          <Mic className="w-3 h-3" />
          Réserver
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => navigate('/offres')}
          className="h-7 px-2 text-xs gap-1"
        >
          <Euro className="w-3 h-3" />
          Offres
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => navigate('/arsenal')}
          className="h-7 px-2 text-xs gap-1"
        >
          <Headphones className="w-3 h-3" />
          Studio
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => navigate('/instrumentals')}
          className="h-7 px-2 text-xs gap-1 text-accent border-accent/50"
        >
          <Music className="w-3 h-3" />
          Beats
        </Button>
      </div>

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
