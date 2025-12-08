import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Mic, Headphones } from "lucide-react";

const Hero = () => {
  const { t } = useTranslation();

  const scrollToBooking = () => {
    document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToGear = () => {
    document.getElementById('gear')?.scrollIntoView({ behavior: 'smooth' });
  };

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
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 mb-8">
            <span className="w-2 h-2 rounded-full bg-primary animate-glow-pulse" />
            <span className="text-sm text-primary font-medium tracking-wide">{t("hero.badge")}</span>
          </div>
          
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
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button variant="hero" size="xl" onClick={scrollToBooking}>
              <Mic className="w-5 h-5" />
              {t("hero.cta_book").toUpperCase()}
            </Button>
            <Button variant="neon" size="xl" onClick={scrollToGear}>
              <Headphones className="w-5 h-5" />
              {t("hero.cta_discover").toUpperCase()}
            </Button>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-xl mx-auto">
            <div className="text-center">
              <div className="font-display text-4xl md:text-5xl text-primary text-glow-cyan mb-1">45€</div>
              <div className="text-sm text-muted-foreground">{t("pricing.per_hour")} + eng.</div>
            </div>
            <div className="text-center border-x border-border">
              <div className="font-display text-4xl md:text-5xl text-accent text-glow-gold mb-1">22€</div>
              <div className="text-sm text-muted-foreground">{t("pricing.per_hour")} dry</div>
            </div>
            <div className="text-center">
              <div className="font-display text-4xl md:text-5xl text-foreground mb-1">PRO</div>
              <div className="text-sm text-muted-foreground">Studio quality</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-float">
        <div className="w-6 h-10 rounded-full border-2 border-primary/50 flex justify-center pt-2">
          <div className="w-1 h-3 rounded-full bg-primary animate-glow-pulse" />
        </div>
      </div>
    </section>
  );
};

export default Hero;