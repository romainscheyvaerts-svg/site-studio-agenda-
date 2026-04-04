import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import ChatBot from "@/components/ChatBot";
import Footer from "@/components/Footer";
import AdminPanel from "@/components/AdminPanel";
import { useAdmin } from "@/hooks/useAdmin";
import { useStudio } from "@/hooks/useStudio";

const Index = () => {
  const { isAdmin } = useAdmin();
  const { studio } = useStudio();

  return (
    <main className="min-h-screen bg-background relative">
      <div className="relative z-10">
        <Navbar />
        <div id="hero">
          <Hero />
        </div>
        <Footer />
      </div>
      {(studio as any)?.show_chatbot !== false && <ChatBot />}
      {isAdmin && <AdminPanel />}
    </main>
  );
};

export default Index;
