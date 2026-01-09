import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mic, Headphones, Music, CalendarDays } from "lucide-react";
import { usePricing } from "@/hooks/usePricing";
import { useAdmin } from "@/hooks/useAdmin";

const Hero = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getEffectivePrice, loading } = usePricing();
  const { isAdmin } = useAdmin();

  const scrollToBooking = () => {
    document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToGear = () => {
    document.getElementById('gear')?.scrollIntoView({ behavior: 'smooth' });
  };

  const goToInstrumentals = () => {
    navigate('/instrumentals');
  };

  const openAdminCalendar = () => {
    // Dispatch event to open the admin calendar in BookingSection
    window.dispatchEvent(new CustomEvent('open-admin-calendar'));
    // Scroll to booking section
    setTimeout(() => {
      const bookingSection = document.getElementById('booking');
      if (bookingSection) {
        bookingSection.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const priceWithEngineer = getEffectivePrice("with-engineer") || 45;
  const priceWithoutEngineer = getEffectivePrice("without-engineer") || 22;

  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden noise-bg">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-secondary/20 to-background" />
      
      {/* Animated grid */}
      <div className="absolute inset-0 bg-grid-pattern bg-[size:60px_60px] opacity-20" />
      
      {/* Glowing orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse-slow" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: '1s' }} />
      
      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 text-center">
        <div className="animate-slide-up">
          {/* Main title */}
          <h1 className="font-display text-6xl md:text-8xl lg:text-9xl text-foreground mb-6 leading-none">
            {t("hero.title1")}
            <br />
            <span className="text-glow-cyan text-primary">{t("hero.title2")} {t("hero.title3")}</span>
          </h1>
          
          {/* Subtitle */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            {t("hero.description")}
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-4">
            <Button variant="hero" size="xl" onClick={scrollToBooking}>
              <Mic className="w-5 h-5" />
              {t("hero.cta_book").toUpperCase()}
            </Button>
            <Button variant="neon" size="xl" onClick={scrollToGear}>
              <Headphones className="w-5 h-5" />
              {t("hero.cta_discover").toUpperCase()}
            </Button>
            <Button variant="outline" size="xl" onClick={goToInstrumentals} className="border-accent/50 hover:bg-accent/10 hover:border-accent">
              <Music className="w-5 h-5" />
              INSTRUMENTAUX
            </Button>
          </div>

          {/* Admin: View Calendar Button */}
          {isAdmin && (
            <div className="flex justify-center mb-12">
              <Button 
                variant="outline" 
                size="lg" 
                onClick={openAdminCalendar}
                className="border-green-500 text-green-500 hover:bg-green-500/10 hover:border-green-400"
              >
                <CalendarDays className="w-5 h-5" />
                Voir l'agenda
              </Button>
            </div>
          )}

          {!isAdmin && <div className="mb-12" />}
          
          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-xl mx-auto">
            <div className="text-center">
              <div className="font-display text-4xl md:text-5xl text-primary text-glow-cyan mb-1">
                {loading ? "..." : `${priceWithEngineer}€`}
              </div>
              <div className="text-sm text-muted-foreground">{t("pricing.per_hour")} + eng.</div>
            </div>
            <div className="text-center border-x border-border">
              <div className="font-display text-4xl md:text-5xl text-accent mb-1">
                {loading ? "..." : `${priceWithoutEngineer}€`}
              </div>
              <div className="text-sm text-muted-foreground">{t("pricing.per_hour")} dry</div>
            </div>
            <div className="text-center">
              <div className="font-display text-4xl md:text-5xl text-foreground mb-1">PRO</div>
              <div className="text-sm text-muted-foreground">Studio quality</div>
            </div>
          </div>
        </div>
      </div>
      
    </section>
  );
};

export default Hero;