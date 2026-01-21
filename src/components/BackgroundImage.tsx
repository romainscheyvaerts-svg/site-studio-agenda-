import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface BackgroundConfig {
  enabled: boolean;
  imageUrl: string | null;
  opacity: number;
  blur: number;
  positionX: number;
  positionY: number;
  scale: number;
}

const DEFAULT_CONFIG: BackgroundConfig = {
  enabled: false,
  imageUrl: null,
  opacity: 30,
  blur: 0,
  positionX: 50,
  positionY: 50,
  scale: 100,
};

// Mapping des routes vers les IDs de page
const ROUTE_TO_PAGE_ID: Record<string, string> = {
  "/": "home",
  "/offres": "offres",
  "/daw": "daw",
  "/reservation": "reservation",
  "/studio": "studio",
  "/instrumentals": "instrumentals",
  "/arsenal": "arsenal",
  "/gallery": "gallery",
  "/music": "music",
};

const BackgroundImage = () => {
  const location = useLocation();
  const [config, setConfig] = useState<BackgroundConfig>(DEFAULT_CONFIG);
  const [currentPageId, setCurrentPageId] = useState<string>("home");

  // Déterminer l'ID de page basé sur la route
  useEffect(() => {
    const pathname = location.pathname;
    const pageId = ROUTE_TO_PAGE_ID[pathname] || "home";
    setCurrentPageId(pageId);
  }, [location.pathname]);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        // Essayer d'abord la config spécifique à la page
        const configKey = `background_image_${currentPageId}`;
        const { data, error } = await supabase
          .from("site_config")
          .select("config_value")
          .eq("config_key", configKey)
          .single();

        if (!error && data) {
          const savedConfig = JSON.parse(data.config_value);
          setConfig({ ...DEFAULT_CONFIG, ...savedConfig });
          return;
        }

        // Fallback: si c'est la page d'accueil, essayer l'ancienne config globale
        if (currentPageId === "home") {
          const { data: oldData, error: oldError } = await supabase
            .from("site_config")
            .select("config_value")
            .eq("config_key", "background_image")
            .single();

          if (!oldError && oldData) {
            const savedConfig = JSON.parse(oldData.config_value);
            setConfig({ ...DEFAULT_CONFIG, ...savedConfig });
            return;
          }
        }

        // Pas de config trouvée, utiliser les valeurs par défaut
        setConfig(DEFAULT_CONFIG);
      } catch (err) {
        console.error("Error fetching background config:", err);
        setConfig(DEFAULT_CONFIG);
      }
    };

    fetchConfig();

    // Écouter les changements en temps réel pour cette page
    const configKey = `background_image_${currentPageId}`;
    const channel = supabase
      .channel(`background_changes_${currentPageId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "site_config",
          filter: `config_key=eq.${configKey}`,
        },
        (payload) => {
          if (payload.new && "config_value" in payload.new) {
            const newConfig = JSON.parse(payload.new.config_value as string);
            setConfig({ ...DEFAULT_CONFIG, ...newConfig });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentPageId]);

  // Ne rien afficher si désactivé ou pas d'image
  if (!config.enabled || !config.imageUrl) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0"
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 bg-cover bg-no-repeat transition-all duration-500"
        style={{
          backgroundImage: `url(${config.imageUrl})`,
          backgroundPosition: `${config.positionX}% ${config.positionY}%`,
          filter: `blur(${config.blur}px)`,
          opacity: config.opacity / 100,
          transform: `scale(${config.scale / 100})`,
          transformOrigin: "center center",
        }}
      />
      {/* Overlay gradient pour assurer la lisibilité */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background/80" />
    </div>
  );
};

export default BackgroundImage;
