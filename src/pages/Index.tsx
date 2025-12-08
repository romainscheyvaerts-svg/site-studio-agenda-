import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import GearSection from "@/components/GearSection";
import PricingSection from "@/components/PricingSection";
import BookingSection from "@/components/BookingSection";
import ChatBot from "@/components/ChatBot";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div id="hero">
        <Hero />
      </div>
      <GearSection />
      <PricingSection />
      <BookingSection />
      <Footer />
      <ChatBot />
    </main>
  );
};

export default Index;
