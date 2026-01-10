import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import GearSection from "@/components/GearSection";
import StudioGallery from "@/components/StudioGallery";
import Footer from "@/components/Footer";

const Arsenal = () => {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20">
        <div className="container mx-auto px-4 py-6">
          <Button 
            variant="outline" 
            onClick={() => navigate("/")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à l'accueil
          </Button>
        </div>
        <GearSection />
        <StudioGallery />
      </div>
      <Footer />
    </main>
  );
};

export default Arsenal;
