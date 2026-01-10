import Navbar from "@/components/Navbar";
import BookingSection from "@/components/BookingSection";
import Footer from "@/components/Footer";
import QuickNavigation from "@/components/QuickNavigation";

const Reservation = () => {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20">
        <div className="container mx-auto px-4 py-4">
          <QuickNavigation />
        </div>
        <BookingSection />
      </div>
      <Footer />
    </main>
  );
};

export default Reservation;
