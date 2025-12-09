import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Check, Mic, Building2, Music2, Sparkles, Disc3, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import QuoteRequestDialog from "./QuoteRequestDialog";

interface PricingCardProps {
  title: string;
  subtitle: string;
  price: string;
  unit: string;
  features: string[];
  icon: React.ReactNode;
  highlighted?: boolean;
  buttonText: string;
}

const PricingCard = ({ title, subtitle, price, unit, features, icon, highlighted, buttonText }: PricingCardProps) => {
  const scrollToBooking = () => {
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
      {highlighted && (
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
        <span className={cn(
          "font-display text-5xl",
          highlighted ? "text-primary text-glow-cyan" : "text-foreground"
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
        onClick={scrollToBooking}
      >
        {buttonText}
      </Button>
    </div>
  );
};

const PricingSection = () => {
  const { t } = useTranslation();

  return (
    <section id="pricing" className="py-24 relative">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-secondary/5 to-background" />
      
      <div className="container mx-auto px-6 relative z-10">
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
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto mb-8">
          <PricingCard
            title={t("pricing.with_engineer.title")}
            subtitle="Session accompagnée"
            price="45€"
            unit={t("pricing.per_hour")}
            icon={<Mic className="w-6 h-6" />}
            highlighted={true}
            buttonText={t("pricing.book").toUpperCase()}
            features={[
              t("pricing.with_engineer.feature1"),
              t("pricing.with_engineer.feature2"),
              t("pricing.with_engineer.feature3"),
              t("pricing.with_engineer.feature4"),
              "⭐ Dès 5h : 40€/h (déduit sur place)",
            ]}
          />

          <PricingCard
            title={t("pricing.without_engineer.title")}
            subtitle="Sans ingénieur"
            price="22€"
            unit={t("pricing.per_hour")}
            icon={<Building2 className="w-6 h-6" />}
            buttonText={t("pricing.book").toUpperCase()}
            features={[
              t("pricing.without_engineer.feature1"),
              t("pricing.without_engineer.feature2"),
              t("pricing.without_engineer.feature3"),
              t("pricing.without_engineer.feature4"),
              "⭐ Dès 5h : 20€/h (déduit sur place)",
            ]}
          />

          <PricingCard
            title={t("pricing.mixing.title")}
            subtitle="Piste par piste"
            price="200€"
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
            price="60€"
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
            price="100€"
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
        </div>

        {/* Second row - Podcast */}
        <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
          <PricingCard
            title={t("pricing.podcast.title")}
            subtitle="Audio podcast"
            price="40€"
            unit="/min"
            icon={<Radio className="w-6 h-6" />}
            buttonText={t("pricing.book").toUpperCase()}
            features={[
              t("pricing.podcast.feature1"),
              t("pricing.podcast.feature2"),
              t("pricing.podcast.feature3"),
              t("pricing.podcast.feature4"),
              t("pricing.podcast.feature5"),
            ]}
          />
        </div>

        {/* Payment info */}
        <div className="mt-12 max-w-3xl mx-auto">
          <h3 className="font-display text-xl text-center text-foreground mb-6">MODALITÉS DE PAIEMENT</h3>
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
              <p className="text-sm font-semibold text-primary mb-2 text-center">{t("pricing.deposit_50")}</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {t("pricing.with_engineer.title")} (45€/h)
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {t("pricing.mixing.title")} (200€/projet)
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {t("pricing.mastering.title")} (60€{t("pricing.per_track")})
                </li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2 text-center italic">Le reste au studio</p>
            </div>
            <div className="p-4 rounded-xl bg-accent/5 border border-accent/20">
              <p className="text-sm font-semibold text-accent mb-2 text-center">{t("pricing.full_payment")}</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  {t("pricing.without_engineer.title")} (22€/h)
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