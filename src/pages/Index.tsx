import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import GearSection from "@/components/GearSection";
import PricingSection from "@/components/PricingSection";
import BookingSection from "@/components/BookingSection";
import InstrumentalsSection from "@/components/InstrumentalsSection";
import ChatBot from "@/components/ChatBot";
import Footer from "@/components/Footer";
import AdminPanel from "@/components/AdminPanel";
import { useAdmin } from "@/hooks/useAdmin";

const Index = () => {
  const { isAdmin } = useAdmin();

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div id="hero">
      <Hero />
      </div>
      <PricingSection />
      <InstrumentalsSection />
      <BookingSection />
      <GearSection />
      <Footer />
      <ChatBot />
      {isAdmin && <AdminPanel />}
    </main>
  );
};

export default Index;
