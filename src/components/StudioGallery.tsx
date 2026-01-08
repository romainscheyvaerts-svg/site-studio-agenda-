import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import studio1 from "@/assets/studio/studio-1.jpg";

interface GalleryPhoto {
  id: string;
  image_url: string;
  title: string | null;
}

const StudioGallery = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPhotos = async () => {
      const { data } = await supabase
        .from("gallery_photos")
        .select("id, image_url, title")
        .eq("is_active", true)
        .order("sort_order")
        .limit(1);
      
      setPhotos(data || []);
      setLoading(false);
    };
    fetchPhotos();
  }, []);

  // Use first photo from DB or fallback to static image
  const thumbnailImage = photos.length > 0 ? photos[0].image_url : studio1;
  const thumbnailAlt = photos.length > 0 ? photos[0].title || "Studio" : "Studio d'enregistrement";

  return (
    <section id="gallery" className="py-16 bg-background noise-bg relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-8">
          <h2 className="font-display text-3xl md:text-4xl text-foreground mb-2">
            {t("gallery.title", "Notre Studio")}
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {t("gallery.description", "Un espace créatif professionnel conçu pour donner vie à votre musique")}
          </p>
        </div>

        {/* Small thumbnail link to gallery page */}
        <div className="max-w-xs mx-auto">
          <button
            onClick={() => navigate("/gallery")}
            className="group relative w-full rounded-xl overflow-hidden border border-border/50 shadow-lg hover:shadow-xl hover:border-primary/50 transition-all duration-300"
          >
            {loading ? (
              <div className="w-full h-48 bg-muted animate-pulse" />
            ) : (
              <img
                src={thumbnailImage}
                alt={thumbnailAlt}
                className="w-full h-auto transition-transform duration-500 group-hover:scale-105"
              />
            )}
            
            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent opacity-70 group-hover:opacity-90 transition-opacity" />
            
            {/* CTA */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center">
              <div className="flex items-center gap-2 px-4 py-2 bg-primary/90 rounded-full text-primary-foreground text-sm font-medium opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                {t("gallery.cta", "Voir la galerie")}
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </button>
        </div>
      </div>
    </section>
  );
};

export default StudioGallery;
