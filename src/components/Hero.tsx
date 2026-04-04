import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mic, Headphones, Music, CalendarDays, Euro, Calculator } from "lucide-react";
import AdminQuickEventModal from "./AdminQuickEventModal";
import { usePricing } from "@/hooks/usePricing";
import { useViewMode } from "@/hooks/useViewMode";
import { useStudio } from "@/hooks/useStudio";
import { cn } from "@/lib/utils";

const Hero = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { services, loading: pricingLoading, getEffectivePrice } = usePricing();
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

  // Advanced design settings
  const heroTitleSize = s?.hero_title_size || "9xl";
  const heroSubtitleSize = s?.hero_subtitle_size || "xl";
  const btnStyle = s?.button_style || "rounded";
  const btnSize = (s?.button_size || "xl") as "sm" | "default" | "lg" | "xl";
  const btnLayout = s?.button_layout || "row";
  const heroLayoutAlign = s?.hero_layout || "center";

  // Map button_style to CSS border-radius
  const btnRoundedClass = btnStyle === "pill" ? "rounded-full" : btnStyle === "square" ? "rounded-none" : "rounded-lg";

  // Map hero layout alignment
  const heroAlignClass = heroLayoutAlign === "left" ? "text-left items-start" : heroLayoutAlign === "right" ? "text-right items-end" : "text-center items-center";

  // Map hero title size to responsive classes  
  const titleSizeMap: Record<string, string> = {
    "5xl": "text-3xl md:text-4xl lg:text-5xl",
    "6xl": "text-4xl md:text-5xl lg:text-6xl",
    "7xl": "text-4xl md:text-6xl lg:text-7xl",
    "8xl": "text-5xl md:text-7xl lg:text-8xl",
    "9xl": "text-6xl md:text-8xl lg:text-9xl",
  };
  const titleClass = titleSizeMap[heroTitleSize] || titleSizeMap["9xl"];

  const subtitleSizeMap: Record<string, string> = {
    "sm": "text-xs md:text-sm",
    "base": "text-sm md:text-base",
    "lg": "text-base md:text-lg",
    "xl": "text-lg md:text-xl",
    "2xl": "text-xl md:text-2xl",
  };
  const subtitleClass = subtitleSizeMap[heroSubtitleSize] || subtitleSizeMap["xl"];

  // Button layout classes
  const btnLayoutClass = btnLayout === "column" ? "flex-col" : btnLayout === "grid" ? "flex-wrap" : "flex-row";

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

  const openAdminCalendar = () => {
    navigate(`${base}/reservation?openCalendar=true`);
  };

  // Dynamic pricing stats: show up to 3 active services
  const activeServices = services.slice(0, 3);
  const colors = ["text-primary text-glow-cyan", "text-accent", "text-foreground"];

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
        "relative z-10 container mx-auto",
        heroAlignClass,
        isMobileView ? "px-5" : "px-6"
      )}>
        <div className={cn("animate-slide-up flex flex-col", heroAlignClass)}>
          {/* Main title */}
          <h1 className={cn(
            "font-display text-foreground leading-none",
            isMobileView ? "text-5xl mb-3" : `${titleClass} mb-6`
          )}>
            {heroLine1}
            <br />
            <span className="text-glow-cyan text-primary">{heroLine2}</span>
          </h1>
          
          {/* Subtitle */}
          <p className={cn(
            "text-muted-foreground max-w-2xl leading-relaxed",
            heroLayoutAlign === "center" && "mx-auto",
            isMobileView ? "text-sm mb-6" : `${subtitleClass} mb-10`
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
            /* Desktop: buttons - respect section visibility + advanced design */
            <div className={cn("flex gap-4 mb-4", btnLayoutClass, heroLayoutAlign === "center" ? "justify-center" : heroLayoutAlign === "left" ? "justify-start" : "justify-end")}>
              {!isAdmin && showBooking && (
                <Button 
                  variant="hero" 
                  size={btnSize}
                  onClick={goToBooking}
                  className={btnRoundedClass}
                >
                  <Mic className="w-5 h-5" />
                  {t("hero.cta_book").toUpperCase()}
                </Button>
              )}
              {showPricing && (
                <Button 
                  variant="neon" 
                  size={btnSize}
                  onClick={goToOffers}
                  className={btnRoundedClass}
                >
                  <Euro className="w-5 h-5" />
                  {t("quick_nav.offers").toUpperCase()}
                </Button>
              )}
              {showGear && (
                <Button 
                  variant="outline" 
                  size={btnSize}
                  onClick={goToGear}
                  className={cn("border-primary/50 hover:bg-primary/10 hover:border-primary", btnRoundedClass)}
                >
                  <Headphones className="w-5 h-5" />
                  {t("hero.cta_discover").toUpperCase()}
                </Button>
              )}
              {showInstrumentals && (
                <Button 
                  variant="outline" 
                  size={btnSize}
                  onClick={goToInstrumentals} 
                  className={cn("border-accent/50 hover:bg-accent/10 hover:border-accent", btnRoundedClass)}
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

          {/* Dynamic Pricing Stats - only show if there are active services */}
          {showPricing && activeServices.length > 0 && (
            <div className={cn(
              "grid max-w-xl mx-auto",
              activeServices.length === 1 ? "grid-cols-1" : activeServices.length === 2 ? "grid-cols-2" : "grid-cols-3",
              isMobileView ? "gap-1 bg-card/50 rounded-xl p-4 backdrop-blur-sm border border-border/50" : "gap-8"
            )}>
              {activeServices.map((service, index) => (
                <div 
                  key={service.id} 
                  className={cn(
                    "text-center",
                    index > 0 && (isMobileView ? "border-l border-border/50" : "border-l border-border")
                  )}
                >
                  <div className={cn(
                    "font-display",
                    colors[index % colors.length],
                    isMobileView ? "text-2xl mb-0.5" : "text-4xl md:text-5xl mb-1"
                  )}>
                    {pricingLoading ? "..." : `${getEffectivePrice(service.service_key)}€`}
                  </div>
                  <div className={cn(
                    "text-muted-foreground",
                    isMobileView ? "text-[10px] leading-tight" : "text-sm"
                  )}>
                    {isMobileView 
                      ? service.name_fr.length > 15 ? service.name_fr.substring(0, 15) + "…" : service.name_fr
                      : `${service.price_unit === '/h' ? t("pricing.per_hour") : service.price_unit} · ${service.name_fr}`
                    }
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
      
    </section>
  );
};

export default Hero;
