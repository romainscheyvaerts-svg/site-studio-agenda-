import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Mic, Building2, Music2, Sparkles, Disc3, Radio, PenTool, Package } from "lucide-react";
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
  discount_composition?: number | null;
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

// Map service_key to icon
const serviceIconMap: Record<string, React.ReactNode> = {
  'with-engineer': <Mic className="w-6 h-6" />,
  'without-engineer': <Building2 className="w-6 h-6" />,
  'mixing': <Music2 className="w-6 h-6" />,
  'mastering': <Sparkles className="w-6 h-6" />,
  'analog-mastering': <Disc3 className="w-6 h-6" />,
  'podcast': <Radio className="w-6 h-6" />,
  'composition': <PenTool className="w-6 h-6" />,
};

const serviceIconMapMobile: Record<string, React.ReactNode> = {
  'with-engineer': <Mic className="w-5 h-5" />,
  'without-engineer': <Building2 className="w-5 h-5" />,
  'mixing': <Music2 className="w-5 h-5" />,
  'mastering': <Sparkles className="w-5 h-5" />,
  'analog-mastering': <Disc3 className="w-5 h-5" />,
  'podcast': <Radio className="w-5 h-5" />,
  'composition': <PenTool className="w-5 h-5" />,
};

// Map price_unit to display string
const unitDisplayMap: Record<string, string> = {
  '/h': '/heure',
  '/projet': '/projet',
  '/track': '/track',
  '/min': '/min',
};

const PricingCard = ({ title, subtitle, price, originalPrice, hasDiscount, discountPercent, unit, features, icon, highlighted, buttonText, isMobileView, onSelectService }: PricingCardProps & { onSelectService: (serviceType: string) => void }) => {
  const handleClick = () => {
    onSelectService(title);
  };

  return (
    <div className={cn(
      "relative flex flex-col rounded-2xl border transition-all duration-300 hover:scale-[1.02] group",
      isMobileView ? "p-3" : "p-6",
      highlighted
        ? "border-primary/50 bg-primary/5 shadow-[0_0_40px_hsl(var(--neon-cyan)/0.15)]"
        : "border-border bg-card/50 hover:border-primary/30"
    )}>
      {hasDiscount && (
        <div className={cn(
          "absolute -top-3 right-4 bg-destructive text-white rounded-full font-bold",
          isMobileView ? "text-[10px] px-2 py-0.5" : "text-xs px-3 py-1"
        )}>
          -{discountPercent}%
        </div>
      )}

      <div className={cn("flex items-center gap-3", isMobileView ? "mb-2" : "mb-4")}>
        <div className={cn(
          "rounded-lg flex items-center justify-center",
          isMobileView ? "w-8 h-8" : "w-12 h-12",
          highlighted ? "bg-primary/10 text-primary" : "bg-secondary text-foreground"
        )}>
          {icon}
        </div>
        <div>
          <h3 className={cn("font-display text-foreground", isMobileView ? "text-sm" : "text-xl")}>{title}</h3>
          <p className={cn("text-muted-foreground", isMobileView ? "text-[10px]" : "text-xs")}>{subtitle}</p>
        </div>
      </div>

      <div className={cn("flex items-baseline", isMobileView ? "mb-3" : "mb-6")}>
        {hasDiscount && originalPrice && (
          <span className={cn("line-through text-muted-foreground mr-2", isMobileView ? "text-sm" : "text-lg")}>
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

      {/* Features */}
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

  const getFeatures = (serviceKey: string): string[] => {
    return serviceFeatures
      .filter(f => f.service_key === serviceKey)
      .map(f => {
        if (currentLang === "en" && f.feature_text_en) return f.feature_text_en;
        if (currentLang === "nl" && f.feature_text_nl) return f.feature_text_nl;
        if (currentLang === "es" && f.feature_text_es) return f.feature_text_es;
        return f.feature_text;
      });
  };

  const getPrice = (serviceKey: string): number => {
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
      'composition': (salesConfig as any).discount_composition,
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
      'composition': (salesConfig as any).discount_composition,
    };
    return discountMap[serviceKey] ?? salesConfig.discount_percentage ?? 0;
  };

  // If no services and not loading, show nothing
  if (!loading && services.length === 0) {
    return null;
  }

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

        {/* Pricing grid - DYNAMIC based on services from DB */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className={cn(
            "max-w-7xl mx-auto grid gap-4",
            isMobileView 
              ? "grid-cols-2" 
              : services.length <= 2 
                ? "md:grid-cols-2 gap-6" 
                : "md:grid-cols-2 lg:grid-cols-3 gap-6"
          )}>
            {services.map((service, index) => {
              const key = service.service_key;
              const icon = isMobileView 
                ? (serviceIconMapMobile[key] || <Package className="w-5 h-5" />) 
                : (serviceIconMap[key] || <Package className="w-6 h-6" />);
              
              const discountInfo = getDiscountedPrice(key);
              const features = getFeatures(key);
              
              // Add volume discount feature for hourly services
              const allFeatures = [...features];
              if (service.price_unit === '/h' && discountInfo.discounted > 0) {
                allFeatures.push(`⭐ Dès 5h : ${Math.round(discountInfo.discounted * 0.9)}€/h (déduit sur place)`);
              }

              return (
                <PricingCard
                  key={service.id}
                  title={service.name_fr}
                  subtitle={key.replace(/-/g, ' ')}
                  price={formatPrice(key)}
                  originalPrice={`${getPrice(key)}€`}
                  hasDiscount={discountInfo.hasDiscount}
                  discountPercent={getDiscountPercent(key)}
                  unit={unitDisplayMap[service.price_unit] || service.price_unit}
                  icon={icon}
                  highlighted={index === 0}
                  buttonText={t("pricing.book").toUpperCase()}
                  isMobileView={isMobileView}
                  onSelectService={handleSelectService}
                  features={allFeatures}
                />
              );
            })}
          </div>
        )}

        {/* Payment info - only show if there are services */}
        {services.length > 0 && (
          <div className={cn("max-w-3xl mx-auto", isMobileView ? "mt-8" : "mt-12")}>
            <p className={cn("text-muted-foreground text-center mb-4", isMobileView ? "text-xs" : "text-base")}>
              {t("pricing.packages_available")}
            </p>
            <div className="text-center">
              <QuoteRequestDialog />
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default PricingSection;
