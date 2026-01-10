import Navbar from "@/components/Navbar";
import GearSection from "@/components/GearSection";
import StudioGallery from "@/components/StudioGallery";
import Footer from "@/components/Footer";
import QuickNavigation from "@/components/QuickNavigation";

const Arsenal = () => {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20">
        <div className="container mx-auto px-4 py-4">
          <QuickNavigation />
        </div>
        <GearSection />
        <StudioGallery />
      </div>
      <Footer />
    </main>
  );
};

export default Arsenal;
