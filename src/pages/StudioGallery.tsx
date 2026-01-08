import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import studio1 from "@/assets/studio/studio-1.jpg";

interface GalleryPhoto {
  id: string;
  image_url: string;
  title: string | null;
  description: string | null;
}

const StudioGalleryPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchPhotos();
  }, []);

  const fetchPhotos = async () => {
    const { data } = await supabase
      .from("gallery_photos")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    
    setPhotos(data || []);
    setLoading(false);
  };

  // If no photos in DB, show fallback static image
  const hasDbPhotos = photos.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-24">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="hover:bg-primary/10"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-4xl font-bold">{t("gallery.title", "Notre Studio")}</h1>
              <p className="text-muted-foreground">
                {t("gallery.description", "Un espace créatif professionnel conçu pour donner vie à votre musique")}
              </p>
            </div>
          </div>

          {/* Gallery grid */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : hasDbPhotos ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {photos.map((photo) => (
                <div 
                  key={photo.id}
                  className="relative rounded-2xl overflow-hidden border border-border/50 shadow-xl group"
                >
                  <img
                    src={photo.image_url}
                    alt={photo.title || "Studio photo"}
                    className="w-full h-64 object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {photo.title && (
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background/90 to-transparent">
                      <p className="text-sm font-medium text-foreground">{photo.title}</p>
                      {photo.description && (
                        <p className="text-xs text-muted-foreground">{photo.description}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-6">
              <div className="relative rounded-2xl overflow-hidden border border-border/50 shadow-xl">
                <img
                  src={studio1}
                  alt="Studio d'enregistrement - Vue principale"
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default StudioGalleryPage;
