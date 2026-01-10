import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mic, Headphones, Music, CalendarDays, AudioLines } from "lucide-react";
import { usePricing } from "@/hooks/usePricing";
import { useAdmin } from "@/hooks/useAdmin";
import { useViewMode } from "@/hooks/useViewMode";
import { cn } from "@/lib/utils";

const Hero = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getEffectivePrice, loading } = usePricing();
  const { isAdmin } = useAdmin();
  const { isMobileView } = useViewMode();

  const goToBooking = () => {
    navigate('/reservation');
  };

  const goToGear = () => {
    navigate('/arsenal');
  };

  const goToInstrumentals = () => {
    navigate('/instrumentals');
  };

  const goToDaw = () => {
    navigate('/daw');
  };

  const openAdminCalendar = () => {
    window.dispatchEvent(new CustomEvent('open-admin-calendar'));
    navigate('/reservation');
  };

  const priceWithEngineer = getEffectivePrice("with-engineer") || 45;
  const priceWithoutEngineer = getEffectivePrice("without-engineer") || 22;

  return (
    <section id="hero" className={cn(
      "relative flex items-center justify-center overflow-hidden noise-bg",
      isMobileView ? "min-h-[100svh] pt-20 pb-8" : "min-h-screen"
    )}>
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-secondary/20 to-background" />
      
      {/* Animated grid */}
      <div className={cn(
        "absolute inset-0 bg-grid-pattern opacity-20",
        isMobileView ? "bg-[size:40px_40px]" : "bg-[size:60px_60px]"
      )} />
      
      {/* Glowing orbs - smaller on mobile */}
      <div className={cn(
        "absolute top-1/4 left-1/4 bg-primary/20 rounded-full animate-pulse-slow",
        isMobileView ? "w-48 h-48 blur-[60px]" : "w-96 h-96 blur-[120px]"
      )} />
      <div className={cn(
        "absolute bottom-1/4 right-1/4 bg-accent/10 rounded-full animate-pulse-slow",
        isMobileView ? "w-40 h-40 blur-[50px]" : "w-80 h-80 blur-[100px]"
      )} style={{ animationDelay: '1s' }} />
      
      {/* Content */}
      <div className={cn(
        "relative z-10 container mx-auto text-center",
        isMobileView ? "px-4" : "px-6"
      )}>
        <div className="animate-slide-up">
          {/* Main title */}
          <h1 className={cn(
            "font-display text-foreground mb-4 leading-none",
            isMobileView ? "text-4xl" : "text-6xl md:text-8xl lg:text-9xl mb-6"
          )}>
            {t("hero.title1")}
            <br />
            <span className="text-glow-cyan text-primary">{t("hero.title2")} {t("hero.title3")}</span>
          </h1>
          
          {/* Subtitle */}
          <p className={cn(
            "text-muted-foreground max-w-2xl mx-auto leading-relaxed",
            isMobileView ? "text-sm mb-6 px-2" : "text-lg md:text-xl mb-10"
          )}>
            {t("hero.description")}
          </p>
          
          {/* CTA Buttons - Stack vertically on mobile */}
          <div className={cn(
            "flex gap-3 justify-center",
            isMobileView ? "flex-col px-4" : "flex-col sm:flex-row gap-4 mb-4"
          )}>
            <Button 
              variant="hero" 
              size={isMobileView ? "lg" : "xl"} 
              onClick={goToBooking}
              className={cn(isMobileView && "w-full")}
            >
              <Mic className="w-5 h-5" />
              {t("hero.cta_book").toUpperCase()}
            </Button>
            <Button 
              variant="neon" 
              size={isMobileView ? "lg" : "xl"} 
              onClick={goToGear}
              className={cn(isMobileView && "w-full")}
            >
              <Headphones className="w-5 h-5" />
              {t("hero.cta_discover").toUpperCase()}
            </Button>
            <Button 
              variant="outline" 
              size={isMobileView ? "lg" : "xl"} 
              onClick={goToInstrumentals} 
              className={cn(
                "border-accent/50 hover:bg-accent/10 hover:border-accent",
                isMobileView && "w-full"
              )}
            >
              <Music className="w-5 h-5" />
              INSTRUMENTAUX
            </Button>
            <Button 
              variant="outline" 
              size={isMobileView ? "lg" : "xl"} 
              onClick={goToDaw} 
              className={cn(
                "border-purple-500/50 hover:bg-purple-500/10 hover:border-purple-500 text-purple-300",
                isMobileView && "w-full"
              )}
            >
              <AudioLines className="w-5 h-5" />
              DAW NOVA STUDIO
            </Button>
          </div>

          {/* Admin: View Calendar Button */}
          {isAdmin && (
            <div className={cn(
              "flex justify-center",
              isMobileView ? "mt-3 mb-6 px-4" : "mb-12"
            )}>
              <Button 
                variant="outline" 
                size={isMobileView ? "default" : "lg"}
                onClick={openAdminCalendar}
                className={cn(
                  "border-green-500 text-green-500 hover:bg-green-500/10 hover:border-green-400",
                  isMobileView && "w-full"
                )}
              >
                <CalendarDays className="w-5 h-5" />
                Voir l'agenda
              </Button>
            </div>
          )}

          {!isAdmin && <div className={isMobileView ? "mb-4" : "mb-12"} />}
          
          {/* Stats - More compact on mobile */}
          <div className={cn(
            "grid grid-cols-3 max-w-xl mx-auto",
            isMobileView ? "gap-2 px-2" : "gap-8"
          )}>
            <div className="text-center">
              <div className={cn(
                "font-display text-primary text-glow-cyan mb-1",
                isMobileView ? "text-2xl" : "text-4xl md:text-5xl"
              )}>
                {loading ? "..." : `${priceWithEngineer}€`}
              </div>
              <div className={cn(
                "text-muted-foreground",
                isMobileView ? "text-xs" : "text-sm"
              )}>{t("pricing.per_hour")} + eng.</div>
            </div>
            <div className="text-center border-x border-border">
              <div className={cn(
                "font-display text-accent mb-1",
                isMobileView ? "text-2xl" : "text-4xl md:text-5xl"
              )}>
                {loading ? "..." : `${priceWithoutEngineer}€`}
              </div>
              <div className={cn(
                "text-muted-foreground",
                isMobileView ? "text-xs" : "text-sm"
              )}>{t("pricing.per_hour")} dry</div>
            </div>
            <div className="text-center">
              <div className={cn(
                "font-display text-foreground mb-1",
                isMobileView ? "text-2xl" : "text-4xl md:text-5xl"
              )}>PRO</div>
              <div className={cn(
                "text-muted-foreground",
                isMobileView ? "text-xs" : "text-sm"
              )}>Studio quality</div>
            </div>
          </div>
        </div>
      </div>
      
    </section>
  );
};

export default Hero;