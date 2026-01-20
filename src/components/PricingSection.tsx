import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Mic, Building2, Music2, Sparkles, Disc3, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import QuoteRequestDialog from "./QuoteRequestDialog";
import { supabase } from "@/integrations/supabase/client";
import { useViewMode } from "@/hooks/useViewMode";

interface Service {
  id: string;
  service_key: string;
  name_fr: string;
  base_price: number;
  price_unit: string;
  is_active: boolean;
}

interface ServiceFeature {
  id: string;
  service_key: string;
  feature_text: string;
  feature_text_en?: string;
  feature_text_nl?: string;
  feature_text_es?: string;
  sort_order: number;
}

interface SalesConfig {
  is_active: boolean;
  sale_name: string;
  discount_percentage: number;
  discount_with_engineer: number | null;
  discount_without_engineer: number | null;
  discount_mixing: number | null;
  discount_mastering: number | null;
  discount_analog_mastering: number | null;
  discount_podcast: number | null;
}
interface PricingCardProps {
  title: string;
  subtitle: string;
  price: string;
  originalPrice?: string;
  hasDiscount?: boolean;
  discountPercent?: number;
  unit: string;
  features: string[];
  icon: React.ReactNode;
  highlighted?: boolean;
  buttonText: string;
  isMobileView?: boolean;
}

const PricingCard = ({ title, subtitle, price, originalPrice, hasDiscount, discountPercent, unit, features, icon, highlighted, buttonText, isMobileView, onSelectService }: PricingCardProps & { onSelectService: (serviceType: string) => void }) => {
  const handleClick = () => {
    const serviceMap: Record<string, string> = {
      "Session accompagnée": "with-engineer",
      "Sans ingénieur": "without-engineer",
      "Location sèche": "without-engineer",
      "Piste par piste": "mixing",
      "Finalisation": "mastering",
      "Mastering premium": "analog-mastering",
      "Audio podcast": "podcast",
    };
    
    const serviceType = serviceMap[subtitle] || null;
    if (serviceType) {
      onSelectService(serviceType);
    }
  };

  return (
    <div
      className={cn(
        "relative rounded-xl transition-all duration-300 hover:scale-[1.02] flex flex-col",
        isMobileView ? "p-3" : "p-8",
        highlighted
          ? "bg-card border-2 border-primary box-glow-cyan"
          : "bg-secondary/30 border border-border hover:border-primary/30"
      )}
    >
      {/* Discount badge */}
      {hasDiscount && discountPercent && discountPercent > 0 && (
        <div className={cn(
          "absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground font-bold animate-pulse",
          isMobileView ? "text-[10px]" : "text-sm"
        )}>
          -{discountPercent}%
        </div>
      )}
      
      {highlighted && !hasDiscount && (
        <div className={cn(
          "absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-primary-foreground font-semibold whitespace-nowrap",
          isMobileView ? "text-[9px]" : "text-sm"
        )}>
          POPULAIRE
        </div>
      )}

      <div className={cn("flex items-center gap-2", isMobileView ? "mb-2" : "mb-4")}>
        <div className={cn(
          "rounded-lg flex items-center justify-center flex-shrink-0",
          isMobileView ? "w-8 h-8" : "w-12 h-12",
          highlighted ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
        )}>
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className={cn(
            "font-display text-foreground truncate",
            isMobileView ? "text-sm leading-tight" : "text-xl"
          )}>{title}</h3>
          <p className={cn(
            "text-muted-foreground truncate",
            isMobileView ? "text-[10px]" : "text-sm"
          )}>{subtitle}</p>
        </div>
      </div>

      <div className={isMobileView ? "mb-2" : "mb-6"}>
        {hasDiscount && originalPrice && (
          <span className={cn("text-muted-foreground line-through mr-1", isMobileView ? "text-xs" : "text-xl")}>
            {originalPrice}
          </span>
        )}
        <span className={cn(
          "font-display",
          isMobileView ? "text-2xl" : "text-5xl",
          hasDiscount ? "text-destructive" : highlighted ? "text-primary text-glow-cyan" : "text-foreground"
        )}>
          {price}
        </span>
        <span className={cn("text-muted-foreground ml-1", isMobileView ? "text-[10px]" : "text-sm")}>{unit}</span>
      </div>

      {/* Features - shown on both mobile and desktop */}
      <ul className={cn("flex-grow", isMobileView ? "mb-3 space-y-1.5" : "mb-6 space-y-3")}>
        {features.map((feature, index) => (
          <li key={index} className={cn("flex items-start gap-2", isMobileView ? "text-[10px]" : "text-sm")}>
            <Check className={cn(
              "flex-shrink-0 mt-0.5",
              isMobileView ? "w-3 h-3" : "w-4 h-4",
              highlighted ? "text-primary" : "text-accent"
            )} />
            <span className="text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>

      <Button
        variant={highlighted ? "hero" : "neon"}
        className={cn("w-full mt-auto", isMobileView && "h-9 text-xs")}
        size={isMobileView ? "sm" : "lg"}
        onClick={handleClick}
      >
        {buttonText}
      </Button>
    </div>
  );
};
const PricingSection = () => {
  const { t, i18n } = useTranslation();
  const { isMobileView } = useViewMode();
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [serviceFeatures, setServiceFeatures] = useState<ServiceFeature[]>([]);
  const [salesConfig, setSalesConfig] = useState<SalesConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Get current language code (fr, en, nl, es)
  const currentLang = i18n.language?.substring(0, 2) || "fr";

  const handleSelectService = (serviceType: string) => {
    navigate(`/reservation?service=${serviceType}`);
  };

  useEffect(() => {
    const fetchData = async () => {
      const [servicesRes, salesRes, featuresRes] = await Promise.all([
        supabase.from("services").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("sales_config").select("*").limit(1).single(),
        supabase.from("service_features").select("*").eq("is_active", true).order("sort_order")
      ]);

      if (servicesRes.data) setServices(servicesRes.data);
      if (salesRes.data) setSalesConfig(salesRes.data as SalesConfig);
      if (featuresRes.data) setServiceFeatures(featuresRes.data);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Get features for a specific service with translation based on current language
  const getFeatures = (serviceKey: string): string[] => {
    return serviceFeatures
      .filter(f => f.service_key === serviceKey)
      .map(f => {
        // Return translated text based on current language, fallback to French
        if (currentLang === "en" && f.feature_text_en) {
          return f.feature_text_en;
        }
        if (currentLang === "nl" && f.feature_text_nl) {
          return f.feature_text_nl;
        }
        if (currentLang === "es" && f.feature_text_es) {
          return f.feature_text_es;
        }
        // Default to French text
        return f.feature_text;
      });
  };

  const getPrice = (serviceKey: string): number => {
    // Normalize: accept both with_engineer and with-engineer
    const normalizedKey = serviceKey.replace(/_/g, '-');
    const service = services.find(s => s.service_key === normalizedKey);
    return service?.base_price || 0;
  };

  const getDiscountedPrice = (serviceKey: string): { original: number; discounted: number; hasDiscount: boolean } => {
    const original = getPrice(serviceKey);
    if (!salesConfig?.is_active) return { original, discounted: original, hasDiscount: false };

    const discountMap: Record<string, number | null | undefined> = {
      'with-engineer': salesConfig.discount_with_engineer,
      'without-engineer': salesConfig.discount_without_engineer,
      'mixing': salesConfig.discount_mixing,
      'mastering': salesConfig.discount_mastering,
      'analog-mastering': salesConfig.discount_analog_mastering,
      'podcast': salesConfig.discount_podcast,
    };

    const discount = discountMap[serviceKey] ?? salesConfig.discount_percentage;
    if (!discount || discount <= 0) return { original, discounted: original, hasDiscount: false };

    const discounted = Math.round(original * (1 - discount / 100));
    return { original, discounted, hasDiscount: true };
  };

  const formatPrice = (serviceKey: string): string => {
    const { discounted } = getDiscountedPrice(serviceKey);
    return `${discounted}€`;
  };

  const getDiscountPercent = (serviceKey: string): number => {
    if (!salesConfig?.is_active) return 0;
    const discountMap: Record<string, number | null | undefined> = {
      'with-engineer': salesConfig.discount_with_engineer,
      'without-engineer': salesConfig.discount_without_engineer,
      'mixing': salesConfig.discount_mixing,
      'mastering': salesConfig.discount_mastering,
      'analog-mastering': salesConfig.discount_analog_mastering,
      'podcast': salesConfig.discount_podcast,
    };
    return discountMap[serviceKey] ?? salesConfig.discount_percentage ?? 0;
  };

  return (
    <section id="pricing" className={cn("relative", isMobileView ? "py-12" : "py-24")}>
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-secondary/5 to-background" />
      
      <div className={cn("container mx-auto relative z-10", isMobileView ? "px-4" : "px-6")}>
        {/* Sale Banner */}
        {salesConfig?.is_active && (
          <div className={cn(
            "mb-8 rounded-xl bg-gradient-to-r from-destructive/20 via-destructive/10 to-destructive/20 border border-destructive/30 text-center animate-pulse",
            isMobileView ? "p-3" : "p-4"
          )}>
            <span className={cn("font-bold text-destructive", isMobileView ? "text-lg" : "text-2xl")}>
              🔥 {salesConfig.sale_name} 🔥
            </span>
            <p className={cn("text-muted-foreground mt-1", isMobileView ? "text-xs" : "text-sm")}>
              {t("pricing.sale_description")}
            </p>
          </div>
        )}
        
        {/* Header */}
        <div className={cn("text-center", isMobileView ? "mb-8" : "mb-16")}>
          <span className={cn(
            "inline-block px-4 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary font-medium mb-4",
            isMobileView ? "text-xs" : "text-sm"
          )}>
            {t("pricing.badge")}
          </span>
          <h2 className={cn("font-display text-foreground mb-4", isMobileView ? "text-3xl" : "text-5xl md:text-7xl")}>
            {t("pricing.title")} <span className="text-accent text-glow-gold">{t("pricing.title_highlight")}</span>
          </h2>
          <p className={cn("text-muted-foreground max-w-xl mx-auto", isMobileView ? "text-sm" : "text-base")}>
            {t("pricing.description")}
          </p>
        </div>

        {/* Pricing grid */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
        <div className={cn(
          "max-w-7xl mx-auto grid gap-4",
          isMobileView 
            ? "grid-cols-2" 
            : "md:grid-cols-2 lg:grid-cols-3 gap-6"
        )}>
          <PricingCard
            title={t("pricing.with_engineer.title")}
            subtitle="Session accompagnée"
            price={formatPrice('with-engineer')}
            originalPrice={`${getPrice('with-engineer')}€`}
            hasDiscount={getDiscountedPrice('with-engineer').hasDiscount}
            discountPercent={getDiscountPercent('with-engineer')}
            unit={t("pricing.per_hour")}
            icon={<Mic className={cn(isMobileView ? "w-5 h-5" : "w-6 h-6")} />}
            highlighted={true}
            buttonText={t("pricing.book").toUpperCase()}
            isMobileView={isMobileView}
            onSelectService={handleSelectService}
            features={[
              ...getFeatures('with-engineer'),
              `⭐ Dès 5h : ${Math.round(getDiscountedPrice('with-engineer').discounted * 0.9)}€/h (déduit sur place)`,
            ]}
          />

          <PricingCard
            title={t("pricing.without_engineer.title")}
            subtitle="Sans ingénieur"
            price={formatPrice('without-engineer')}
            originalPrice={`${getPrice('without-engineer')}€`}
            hasDiscount={getDiscountedPrice('without-engineer').hasDiscount}
            discountPercent={getDiscountPercent('without-engineer')}
            unit={t("pricing.per_hour")}
            icon={<Building2 className={cn(isMobileView ? "w-5 h-5" : "w-6 h-6")} />}
            buttonText={t("pricing.book").toUpperCase()}
            isMobileView={isMobileView}
            onSelectService={handleSelectService}
            features={[
              ...getFeatures('without-engineer'),
              `⭐ Dès 5h : ${Math.round(getDiscountedPrice('without-engineer').discounted * 0.9)}€/h (déduit sur place)`,
            ]}
          />

          <PricingCard
            title={t("pricing.mixing.title")}
            subtitle="Piste par piste"
            price={formatPrice('mixing')}
            originalPrice={`${getPrice('mixing')}€`}
            hasDiscount={getDiscountedPrice('mixing').hasDiscount}
            discountPercent={getDiscountPercent('mixing')}
            unit="/projet"
            icon={<Music2 className={cn(isMobileView ? "w-5 h-5" : "w-6 h-6")} />}
            buttonText={t("pricing.book").toUpperCase()}
            isMobileView={isMobileView}
            onSelectService={handleSelectService}
            features={getFeatures('mixing')}
          />

          <PricingCard
            title={t("pricing.mastering.title")}
            subtitle="Finalisation"
            price={formatPrice('mastering')}
            originalPrice={`${getPrice('mastering')}€`}
            hasDiscount={getDiscountedPrice('mastering').hasDiscount}
            discountPercent={getDiscountPercent('mastering')}
            unit={t("pricing.per_track")}
            icon={<Sparkles className={cn(isMobileView ? "w-5 h-5" : "w-6 h-6")} />}
            buttonText={t("pricing.book").toUpperCase()}
            isMobileView={isMobileView}
            onSelectService={handleSelectService}
            features={getFeatures('mastering')}
          />

          <PricingCard
            title={t("pricing.analog_mastering.title")}
            subtitle="Mastering premium"
            price={formatPrice('analog-mastering')}
            originalPrice={`${getPrice('analog-mastering')}€`}
            hasDiscount={getDiscountedPrice('analog-mastering').hasDiscount}
            discountPercent={getDiscountPercent('analog-mastering')}
            unit={t("pricing.per_track")}
            icon={<Disc3 className={cn(isMobileView ? "w-5 h-5" : "w-6 h-6")} />}
            buttonText={t("pricing.book").toUpperCase()}
            isMobileView={isMobileView}
            onSelectService={handleSelectService}
            features={getFeatures('analog-mastering')}
          />

          <PricingCard
            title={t("pricing.podcast.title")}
            subtitle="Audio podcast"
            price={formatPrice('podcast')}
            originalPrice={`${getPrice('podcast')}€`}
            hasDiscount={getDiscountedPrice('podcast').hasDiscount}
            discountPercent={getDiscountPercent('podcast')}
            unit="/min"
            icon={<Radio className={cn(isMobileView ? "w-5 h-5" : "w-6 h-6")} />}
            buttonText={t("pricing.book").toUpperCase()}
            isMobileView={isMobileView}
            onSelectService={handleSelectService}
            features={getFeatures('podcast')}
          />
        </div>
        )}

        {/* Payment info */}
        <div className={cn("max-w-3xl mx-auto", isMobileView ? "mt-8" : "mt-12")}>
          <h3 className={cn("font-display text-center text-foreground", isMobileView ? "text-lg mb-4" : "text-xl mb-6")}>
            {t("pricing.payment_terms")}
          </h3>
          <div className={cn("gap-4 mb-8", isMobileView ? "space-y-3" : "grid md:grid-cols-2")}>
            <div className={cn("rounded-xl bg-primary/5 border border-primary/20", isMobileView ? "p-3" : "p-4")}>
              <p className={cn("font-semibold text-primary mb-2 text-center", isMobileView ? "text-xs" : "text-sm")}>
                {t("pricing.deposit_50")}
              </p>
              <ul className={cn("text-muted-foreground space-y-1", isMobileView ? "text-[10px]" : "text-xs")}>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {t("pricing.with_engineer.title")} ({getPrice("with_engineer")}€/h)
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {t("pricing.mixing.title")} ({getPrice("mixing")}€/projet)
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {t("pricing.mastering.title")} ({getPrice("mastering")}€{t("pricing.per_track")})
                </li>
              </ul>
              <p className={cn("text-muted-foreground mt-2 text-center italic", isMobileView ? "text-[10px]" : "text-xs")}>
                {t("pricing.rest_at_studio")}
              </p>
            </div>
            <div className={cn("rounded-xl bg-accent/5 border border-accent/20", isMobileView ? "p-3" : "p-4")}>
              <p className={cn("font-semibold text-accent mb-2 text-center", isMobileView ? "text-xs" : "text-sm")}>
                {t("pricing.full_payment")}
              </p>
              <ul className={cn("text-muted-foreground space-y-1", isMobileView ? "text-[10px]" : "text-xs")}>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  {t("pricing.without_engineer.title")} ({getPrice("without_engineer")}€/h)
                </li>
              </ul>
              <p className={cn("text-muted-foreground mt-2 text-center italic", isMobileView ? "text-[10px]" : "text-xs")}>
                {t("pricing.pay_at_booking")}
              </p>
            </div>
          </div>
          
          <p className={cn("text-muted-foreground text-center mb-4", isMobileView ? "text-xs" : "text-base")}>
            {t("pricing.packages_available")}
          </p>
          <div className="text-center">
            <QuoteRequestDialog />
          </div>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;