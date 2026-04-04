import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";
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
    </main>
  );
};

export default Index;
