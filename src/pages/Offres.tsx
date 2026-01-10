import Navbar from "@/components/Navbar";
import PricingSection from "@/components/PricingSection";
import Footer from "@/components/Footer";
import QuickNavigation from "@/components/QuickNavigation";

const Offres = () => {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20">
        <div className="container mx-auto px-4 py-4">
          <QuickNavigation />
        </div>
        <PricingSection />
      </div>
      <Footer />
    </main>
  );
};

export default Offres;
