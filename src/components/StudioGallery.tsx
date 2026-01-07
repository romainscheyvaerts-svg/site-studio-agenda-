import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import studio1 from "@/assets/studio/studio-1.jpg";

const StudioGallery = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <section id="gallery" className="py-24 bg-background noise-bg relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-12">
          <h2 className="font-display text-4xl md:text-5xl text-foreground mb-4">
            {t("gallery.title", "Notre Studio")}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t("gallery.description", "Un espace créatif professionnel conçu pour donner vie à votre musique")}
          </p>
        </div>

        {/* Thumbnail link to gallery page */}
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate("/gallery")}
            className="group relative w-full aspect-video rounded-2xl overflow-hidden border border-border/50 shadow-xl hover:shadow-2xl hover:border-primary/50 transition-all duration-300"
          >
            <img
              src={studio1}
              alt="Studio d'enregistrement"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            
            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
            
            {/* CTA */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center gap-2 px-6 py-3 bg-primary/90 rounded-full text-primary-foreground font-medium opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                {t("gallery.cta", "Voir la galerie")}
                <ArrowRight className="w-5 h-5" />
              </div>
            </div>
          </button>
        </div>
      </div>
    </section>
  );
};

export default StudioGallery;
