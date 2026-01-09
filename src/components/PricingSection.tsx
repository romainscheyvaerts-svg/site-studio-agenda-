import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check, Mic, Building2, Music2, Sparkles, Disc3, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import QuoteRequestDialog from "./QuoteRequestDialog";
import { supabase } from "@/integrations/supabase/client";

interface Service {
  id: string;
  service_key: string;
  name_fr: string;
  base_price: number;
  price_unit: string;
  is_active: boolean;
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
}

const PricingCard = ({ title, subtitle, price, originalPrice, hasDiscount, discountPercent, unit, features, icon, highlighted, buttonText }: PricingCardProps) => {
  const scrollToBookingAndSelectService = () => {
    // Dispatch an event to auto-select the service based on title
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
      window.dispatchEvent(new CustomEvent("select-service", { detail: serviceType }));
    }
    
    document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div
      className={cn(
        "relative p-8 rounded-2xl transition-all duration-300 hover:scale-[1.02]",
        highlighted
          ? "bg-card border-2 border-primary box-glow-cyan"
          : "bg-secondary/30 border border-border hover:border-primary/30"
      )}
    >
      {/* Discount badge */}
      {hasDiscount && discountPercent && discountPercent > 0 && (
        <div className="absolute -top-3 -right-3 px-3 py-1 rounded-full bg-destructive text-destructive-foreground text-sm font-bold animate-pulse">
          -{discountPercent}%
        </div>
      )}
      
      {highlighted && !hasDiscount && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-sm font-semibold">
          POPULAIRE
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center",
          highlighted ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
        )}>
          {icon}
        </div>
        <div>
          <h3 className="font-display text-xl text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      <div className="mb-6">
        {hasDiscount && originalPrice && (
          <span className="text-xl text-muted-foreground line-through mr-2">
            {originalPrice}
          </span>
        )}
        <span className={cn(
          "font-display text-5xl",
          hasDiscount ? "text-destructive" : highlighted ? "text-primary text-glow-cyan" : "text-foreground"
        )}>
          {price}
        </span>
        <span className="text-muted-foreground ml-2">{unit}</span>
      </div>

      <ul className="space-y-3 mb-8">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center gap-3 text-sm">
            <Check className={cn(
              "w-4 h-4 flex-shrink-0",
              highlighted ? "text-primary" : "text-accent"
            )} />
            <span className="text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>

      <Button
        variant={highlighted ? "hero" : "neon"}
        className="w-full"
        size="lg"
        onClick={scrollToBookingAndSelectService}
      >
        {buttonText}
      </Button>
    </div>
  );
};

const PricingSection = () => {
  const { t } = useTranslation();
  const [services, setServices] = useState<Service[]>([]);
  const [salesConfig, setSalesConfig] = useState<SalesConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [servicesRes, salesRes] = await Promise.all([
        supabase.from("services").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("sales_config").select("*").limit(1).single()
      ]);

      if (servicesRes.data) setServices(servicesRes.data);
      if (salesRes.data) setSalesConfig(salesRes.data as SalesConfig);
      setLoading(false);
    };
    fetchData();
  }, []);

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
    <section id="pricing" className="py-24 relative">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-secondary/5 to-background" />
      
      <div className="container mx-auto px-6 relative z-10">
        {/* Sale Banner */}
        {salesConfig?.is_active && (
          <div className="mb-8 p-4 rounded-xl bg-gradient-to-r from-destructive/20 via-destructive/10 to-destructive/20 border border-destructive/30 text-center animate-pulse">
            <span className="text-2xl font-bold text-destructive">
              🔥 {salesConfig.sale_name} 🔥
            </span>
            <p className="text-sm text-muted-foreground mt-1">
              Profitez de nos réductions exceptionnelles sur tous nos services !
            </p>
          </div>
        )}
        
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-medium mb-4">
            {t("pricing.badge")}
          </span>
          <h2 className="font-display text-5xl md:text-7xl text-foreground mb-4">
            {t("pricing.title")} <span className="text-accent text-glow-gold">{t("pricing.title_highlight")}</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {t("pricing.description")}
          </p>
        </div>

        {/* Pricing grid */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          <PricingCard
            title={t("pricing.with_engineer.title")}
            subtitle="Session accompagnée"
            price={formatPrice('with-engineer')}
            originalPrice={`${getPrice('with-engineer')}€`}
            hasDiscount={getDiscountedPrice('with-engineer').hasDiscount}
            discountPercent={getDiscountPercent('with-engineer')}
            unit={t("pricing.per_hour")}
            icon={<Mic className="w-6 h-6" />}
            highlighted={true}
            buttonText={t("pricing.book").toUpperCase()}
            features={[
              t("pricing.with_engineer.feature1"),
              t("pricing.with_engineer.feature2"),
              t("pricing.with_engineer.feature3"),
              t("pricing.with_engineer.feature4"),
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
            icon={<Building2 className="w-6 h-6" />}
            buttonText={t("pricing.book").toUpperCase()}
            features={[
              t("pricing.without_engineer.feature1"),
              t("pricing.without_engineer.feature2"),
              t("pricing.without_engineer.feature3"),
              t("pricing.without_engineer.feature4"),
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
            icon={<Music2 className="w-6 h-6" />}
            buttonText={t("pricing.book").toUpperCase()}
            features={[
              t("pricing.mixing.feature1"),
              t("pricing.mixing.feature2"),
              t("pricing.mixing.feature3"),
              t("pricing.mixing.feature4"),
              t("pricing.mixing.feature5"),
            ]}
          />

          <PricingCard
            title={t("pricing.mastering.title")}
            subtitle="Finalisation"
            price={formatPrice('mastering')}
            originalPrice={`${getPrice('mastering')}€`}
            hasDiscount={getDiscountedPrice('mastering').hasDiscount}
            discountPercent={getDiscountPercent('mastering')}
            unit={t("pricing.per_track")}
            icon={<Sparkles className="w-6 h-6" />}
            buttonText={t("pricing.book").toUpperCase()}
            features={[
              t("pricing.mastering.feature1"),
              t("pricing.mastering.feature2"),
              t("pricing.mastering.feature3"),
              t("pricing.mastering.feature4"),
            ]}
          />

          <PricingCard
            title={t("pricing.analog_mastering.title")}
            subtitle="Mastering premium"
            price={formatPrice('analog-mastering')}
            originalPrice={`${getPrice('analog-mastering')}€`}
            hasDiscount={getDiscountedPrice('analog-mastering').hasDiscount}
            discountPercent={getDiscountPercent('analog-mastering')}
            unit={t("pricing.per_track")}
            icon={<Disc3 className="w-6 h-6" />}
            buttonText={t("pricing.book").toUpperCase()}
            features={[
              t("pricing.analog_mastering.feature1"),
              t("pricing.analog_mastering.feature2"),
              t("pricing.analog_mastering.feature3"),
              t("pricing.analog_mastering.feature4"),
              t("pricing.analog_mastering.feature5"),
            ]}
          />

          <PricingCard
            title={t("pricing.podcast.title")}
            subtitle="Audio podcast"
            price={formatPrice('podcast')}
            originalPrice={`${getPrice('podcast')}€`}
            hasDiscount={getDiscountedPrice('podcast').hasDiscount}
            discountPercent={getDiscountPercent('podcast')}
            unit="/min"
            icon={<Radio className="w-6 h-6" />}
            buttonText={t("pricing.book").toUpperCase()}
            features={[
              `Base: ${getDiscountedPrice('podcast').discounted || 40}€/min (jusqu'à 2 pistes)`,
              "4 pistes: +35€/min",
              "6 pistes: +65€/min",
              t("pricing.podcast.feature4"),
              t("pricing.podcast.feature5"),
            ]}
          />
        </div>
        )}

        {/* Payment info */}
        <div className="mt-12 max-w-3xl mx-auto">
          <h3 className="font-display text-xl text-center text-foreground mb-6">MODALITÉS DE PAIEMENT</h3>
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
              <p className="text-sm font-semibold text-primary mb-2 text-center">{t("pricing.deposit_50")}</p>
              <ul className="text-xs text-muted-foreground space-y-1">
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
              <p className="text-xs text-muted-foreground mt-2 text-center italic">Le reste au studio</p>
            </div>
            <div className="p-4 rounded-xl bg-accent/5 border border-accent/20">
              <p className="text-sm font-semibold text-accent mb-2 text-center">{t("pricing.full_payment")}</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  {t("pricing.without_engineer.title")} ({getPrice("without_engineer")}€/h)
                </li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2 text-center italic">À régler à la réservation</p>
            </div>
          </div>
          
          <p className="text-muted-foreground text-center mb-4">
            Forfaits et tarifs dégressifs disponibles pour les projets longs
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