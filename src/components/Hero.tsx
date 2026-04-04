import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mic, Headphones, Music, CalendarDays, AudioLines, Euro, Calculator } from "lucide-react";
import AdminQuickEventModal from "./AdminQuickEventModal";
import { usePricing } from "@/hooks/usePricing";
import { useViewMode } from "@/hooks/useViewMode";
import { useStudio } from "@/hooks/useStudio";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const Hero = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getEffectivePrice, loading } = usePricing();
  const { isMobileView } = useViewMode();
  const { studio, isStudioAdmin } = useStudio();
  const isAdmin = isStudioAdmin;
  const [showQuickEventModal, setShowQuickEventModal] = useState(false);

  // Use custom hero titles from design settings, or auto-split from studio name
  const s = studio as any;
  const studioName = studio?.name?.toUpperCase() || "";
  const nameWords = studioName.split(" ");
  const heroLine1 = s?.hero_title_line1?.toUpperCase() || (studioName ? (nameWords.length > 1 ? nameWords[0] : studioName) : "");
  const heroLine2 = s?.hero_title_line2?.toUpperCase() || (studioName ? (nameWords.length > 1 ? nameWords.slice(1).join(" ") : "") : "");
  const heroSubtitle = s?.hero_subtitle || t("hero.description");
  const heroImageUrl = s?.hero_image_url || null;

  // Section visibility settings
  const showPricing = s?.show_pricing ?? true;
  const showInstrumentals = s?.show_instrumentals ?? true;
  const showGear = s?.show_gear ?? true;
  const showBooking = s?.show_booking ?? true;

  const slug = studio?.slug || "";
  const base = slug ? `/${slug}` : "";

  const goToBooking = () => {
    navigate(`${base}/reservation`);
  };

  const goToGear = () => {
    navigate(`${base}/arsenal`);
  };

  const goToOffers = () => {
    navigate(`${base}/offres`);
  };

  const goToInstrumentals = () => {
    navigate(`${base}/instrumentals`);
  };

  const goToDaw = () => {
    navigate(`${base}/daw`);
  };

  const openAdminCalendar = () => {
    navigate(`${base}/reservation?openCalendar=true`);
  };

  const priceWithEngineer = getEffectivePrice("with-engineer") || 45;
  const priceWithoutEngineer = getEffectivePrice("without-engineer") || 22;

  return (
    <section id="hero" className={cn(
      "relative flex items-center justify-center overflow-hidden noise-bg",
      isMobileView ? "min-h-[100svh] pt-16 pb-6" : "min-h-screen"
    )}>
      {/* Background image or gradient */}
      {heroImageUrl ? (
        <>
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${heroImageUrl})` }} />
          <div className="absolute inset-0 bg-black/60" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-background via-secondary/20 to-background" />
      )}
      
      {/* Animated grid - hidden on mobile for performance */}
      {!isMobileView && (
        <div className="absolute inset-0 bg-grid-pattern opacity-20 bg-[size:60px_60px]" />
      )}
      
      {/* Glowing orbs - smaller and simpler on mobile */}
      <div className={cn(
        "absolute top-1/4 left-1/4 bg-primary/20 rounded-full animate-pulse-slow",
        isMobileView ? "w-32 h-32 blur-[40px]" : "w-96 h-96 blur-[120px]"
      )} />
      <div className={cn(
        "absolute bottom-1/4 right-1/4 bg-accent/10 rounded-full animate-pulse-slow",
        isMobileView ? "w-24 h-24 blur-[30px]" : "w-80 h-80 blur-[100px]"
      )} style={{ animationDelay: '1s' }} />
      
      {/* Content */}
      <div className={cn(
        "relative z-10 container mx-auto text-center",
        isMobileView ? "px-5" : "px-6"
      )}>
        <div className="animate-slide-up">
          {/* Main title */}
          <h1 className={cn(
            "font-display text-foreground leading-none",
            isMobileView ? "text-5xl mb-3" : "text-6xl md:text-8xl lg:text-9xl mb-6"
          )}>
            {heroLine1}
            <br />
            <span className="text-glow-cyan text-primary">{heroLine2}</span>
          </h1>
          
          {/* Subtitle */}
          <p className={cn(
            "text-muted-foreground max-w-2xl mx-auto leading-relaxed",
            isMobileView ? "text-sm mb-6" : "text-lg md:text-xl mb-10"
          )}>
            {heroSubtitle}
          </p>
          
          {/* Mobile: CTA buttons - respect section visibility */}
          {isMobileView ? (
            <div className="space-y-3 mb-6">
              {!isAdmin && showBooking && (
                <Button 
                  variant="hero" 
                  size="lg" 
                  onClick={goToBooking}
                  className="w-full h-14 text-base"
                >
                  <Mic className="w-5 h-5" />
                  {t("hero.cta_book").toUpperCase()}
                </Button>
              )}
              <div className="grid grid-cols-2 gap-3">
                {showPricing && (
                  <Button 
                    variant="neon" 
                    size="default"
                    onClick={goToOffers}
                    className="h-12"
                  >
                    <Euro className="w-4 h-4" />
                    {t("quick_nav.offers").toUpperCase()}
                  </Button>
                )}
                {showGear && (
                  <Button 
                    variant="outline" 
                    size="default"
                    onClick={goToGear}
                    className="h-12 border-primary/50"
                  >
                    <Headphones className="w-4 h-4" />
                    {t("quick_nav.studio").toUpperCase()}
                  </Button>
                )}
              </div>
              {showInstrumentals && (
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    variant="outline" 
                    size="default"
                    onClick={goToInstrumentals}
                    className="h-12 border-accent/50 text-accent"
                  >
                    <Music className="w-4 h-4" />
                    {t("quick_nav.beats").toUpperCase()}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* Desktop: buttons - respect section visibility */
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-4">
              {!isAdmin && showBooking && (
                <Button 
                  variant="hero" 
                  size="xl" 
                  onClick={goToBooking}
                >
                  <Mic className="w-5 h-5" />
                  {t("hero.cta_book").toUpperCase()}
                </Button>
              )}
              {showPricing && (
                <Button 
                  variant="neon" 
                  size="xl" 
                  onClick={goToOffers}
                >
                  <Euro className="w-5 h-5" />
                  {t("quick_nav.offers").toUpperCase()}
                </Button>
              )}
              {showGear && (
                <Button 
                  variant="outline" 
                  size="xl" 
                  onClick={goToGear}
                  className="border-primary/50 hover:bg-primary/10 hover:border-primary"
                >
                  <Headphones className="w-5 h-5" />
                  {t("hero.cta_discover").toUpperCase()}
                </Button>
              )}
              {showInstrumentals && (
                <Button 
                  variant="outline" 
                  size="xl" 
                  onClick={goToInstrumentals} 
                  className="border-accent/50 hover:bg-accent/10 hover:border-accent"
                >
                  <Music className="w-5 h-5" />
                  {t("nav.instrumentals").toUpperCase()}
                </Button>
              )}
            </div>
          )}

          {/* Admin: View Calendar + Add Event Buttons */}
          {isAdmin && (
            <div className={cn(
              "flex justify-center gap-3",
              isMobileView ? "mb-6 flex-col" : "mb-12"
            )}>
              <Button 
                variant="outline" 
                size={isMobileView ? "default" : "lg"}
                onClick={openAdminCalendar}
                className={cn(
                  "border-green-500 text-green-500 hover:bg-green-500/10 hover:border-green-400",
                  isMobileView && "w-full h-12"
                )}
              >
                <CalendarDays className="w-5 h-5" />
                {t("booking.view_calendar")}
              </Button>
              <Button 
                variant="outline" 
                size={isMobileView ? "default" : "lg"}
                onClick={() => setShowQuickEventModal(true)}
                className={cn(
                  "border-purple-500 text-purple-400 hover:bg-purple-500/10 hover:border-purple-400",
                  isMobileView && "w-full h-12"
                )}
              >
                <Calculator className="w-5 h-5" />
                {t("booking.add_event")}
              </Button>
            </div>
          )}

          {/* Admin Quick Event Modal */}
          {isAdmin && (
            <AdminQuickEventModal
              isOpen={showQuickEventModal}
              onClose={() => setShowQuickEventModal(false)}
              onEventCreated={() => {
                setShowQuickEventModal(false);
              }}
            />
          )}

          {!isAdmin && <div className={isMobileView ? "mb-4" : "mb-12"} />}
          
          {/* Stats - Redesigned for mobile */}
          <div className={cn(
            "grid grid-cols-3 max-w-xl mx-auto",
            isMobileView ? "gap-1 bg-card/50 rounded-xl p-4 backdrop-blur-sm border border-border/50" : "gap-8"
          )}>
            <div className="text-center">
              <div className={cn(
                "font-display text-primary text-glow-cyan",
                isMobileView ? "text-2xl mb-0.5" : "text-4xl md:text-5xl mb-1"
              )}>
                {loading ? "..." : `${priceWithEngineer}€`}
              </div>
              <div className={cn(
                "text-muted-foreground",
                isMobileView ? "text-[10px] leading-tight" : "text-sm"
              )}>{isMobileView ? "/h ingé" : `${t("pricing.per_hour")} + eng.`}</div>
            </div>
            <div className={cn("text-center", isMobileView ? "border-x border-border/50" : "border-x border-border")}>
              <div className={cn(
                "font-display text-accent",
                isMobileView ? "text-2xl mb-0.5" : "text-4xl md:text-5xl mb-1"
              )}>
                {loading ? "..." : `${priceWithoutEngineer}€`}
              </div>
              <div className={cn(
                "text-muted-foreground",
                isMobileView ? "text-[10px] leading-tight" : "text-sm"
              )}>{isMobileView ? "/h solo" : `${t("pricing.per_hour")} dry`}</div>
            </div>
            <div className="text-center">
              <div className={cn(
                "font-display text-foreground",
                isMobileView ? "text-2xl mb-0.5" : "text-4xl md:text-5xl mb-1"
              )}>PRO</div>
              <div className={cn(
                "text-muted-foreground",
                isMobileView ? "text-[10px] leading-tight" : "text-sm"
              )}>{isMobileView ? "Qualité" : "Studio quality"}</div>
            </div>
          </div>
        </div>
      </div>
      
    </section>
  );
};

export default Hero;