import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import InstrumentalsSection from "@/components/InstrumentalsSection";
import ChatBot from "@/components/ChatBot";
import Footer from "@/components/Footer";
import AdminPanel from "@/components/AdminPanel";
import { useAdmin } from "@/hooks/useAdmin";

const Index = () => {
  const { isAdmin } = useAdmin();

  return (
    <main className="min-h-screen bg-background relative">
      <div className="relative z-10">
        <Navbar />
        <div id="hero">
          <Hero />
        </div>
        <InstrumentalsSection />
        <Footer />
      </div>
      <ChatBot />
      {isAdmin && <AdminPanel />}
    </main>
  );
};

export default Index;
