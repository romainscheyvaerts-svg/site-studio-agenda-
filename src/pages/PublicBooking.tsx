import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PublicBookingCalendar from "@/components/PublicBookingCalendar";

export default function PublicBooking() {
  useEffect(() => {
    document.title = "Réserver une session | Make Music Studio";
  }, []);

  return (
      
      <div className="min-h-screen bg-background">
        <Navbar />
        
        <main className="container mx-auto px-4 py-24">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold mb-4">Réservez votre session</h1>
              <p className="text-muted-foreground text-lg">
                Sélectionnez un créneau disponible et réservez votre session en quelques clics
              </p>
            </div>

            <PublicBookingCalendar />
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}
