import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import studio1 from "@/assets/studio/studio-1.jpg";

const StudioGalleryPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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
          <div className="grid gap-6">
            <div className="relative rounded-2xl overflow-hidden border border-border/50 shadow-xl">
              <img
                src={studio1}
                alt="Studio d'enregistrement - Vue principale"
                className="w-full h-auto object-cover"
              />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default StudioGalleryPage;
