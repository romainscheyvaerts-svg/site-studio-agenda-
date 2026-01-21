import { useState, useEffect } from "react";
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

const BackgroundImage = () => {
  const [config, setConfig] = useState<BackgroundConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data, error } = await supabase
          .from("site_config")
          .select("config_value")
          .eq("config_key", "background_image")
          .single();

        if (!error && data) {
          const savedConfig = JSON.parse(data.config_value);
          setConfig({ ...DEFAULT_CONFIG, ...savedConfig });
        }
      } catch (err) {
        console.error("Error fetching background config:", err);
      }
    };

    fetchConfig();

    // Écouter les changements en temps réel
    const channel = supabase
      .channel("background_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "site_config",
          filter: "config_key=eq.background_image",
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
  }, []);

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
