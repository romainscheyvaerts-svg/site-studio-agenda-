import { Button } from "@/components/ui/button";
import { Check, Mic, Building2, Music2, Sparkles, Disc3 } from "lucide-react";
import { cn } from "@/lib/utils";

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
  return (
    <section id="pricing" className="py-24 relative">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-secondary/5 to-background" />
      
      <div className="container mx-auto px-6 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-medium mb-4">
            TARIFS TRANSPARENTS
          </span>
          <h2 className="font-display text-5xl md:text-7xl text-foreground mb-4">
            NOS <span className="text-accent text-glow-gold">FORMULES</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Des tarifs adaptés à tous vos projets, du simple enregistrement au mastering professionnel
          </p>
        </div>

        {/* Pricing grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6 max-w-7xl mx-auto">
          <PricingCard
            title="AVEC INGÉNIEUR"
            subtitle="Session accompagnée"
            price="45€"
            unit="/heure"
            icon={<Mic className="w-6 h-6" />}
            highlighted={true}
            buttonText="RÉSERVER"
            features={[
              "Ingénieur son dédié",
              "Setup personnalisé",
              "Direction artistique",
              "Édition en temps réel",
              "Vérification d'identité requise",
            ]}
          />

          <PricingCard
            title="LOCATION SÈCHE"
            subtitle="Sans ingénieur"
            price="22€"
            unit="/heure"
            icon={<Building2 className="w-6 h-6" />}
            buttonText="RÉSERVER"
            features={[
              "Accès au studio complet",
              "Tout le matériel inclus",
              "ProTools installé",
              "Autonomie totale",
              "Vérification identité requise",
            ]}
          />

          <PricingCard
            title="MIXAGE"
            subtitle="Piste par piste"
            price="200€"
            unit="/projet"
            icon={<Music2 className="w-6 h-6" />}
            buttonText="RÉSERVER"
            features={[
              "Mix professionnel",
              "Révisions incluses",
              "Plugins premium",
              "Traitement SSL",
              "Lien Drive envoyé par mail",
            ]}
          />

          <PricingCard
            title="MASTERING"
            subtitle="Finalisation"
            price="60€"
            unit="/titre"
            icon={<Sparkles className="w-6 h-6" />}
            buttonText="RÉSERVER"
            features={[
              "Mastering numérique",
              "Format streaming",
              "Loudness optimisé",
              "Lien Drive envoyé par mail",
            ]}
          />

          <PricingCard
            title="ANALOGIQUE"
            subtitle="Mastering premium"
            price="100€"
            unit="/titre"
            icon={<Disc3 className="w-6 h-6" />}
            buttonText="RÉSERVER"
            features={[
              "Traitement analogique",
              "Warmth et caractère",
              "Chaîne SSL complète",
              "Lien Drive envoyé par mail",
              "Paiement 100% requis",
            ]}
          />
        </div>

        {/* Payment info */}
        <div className="mt-12 max-w-3xl mx-auto">
          <h3 className="font-display text-xl text-center text-foreground mb-6">MODALITÉS DE PAIEMENT</h3>
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
              <p className="text-sm font-semibold text-primary mb-2 text-center">50% d'acompte</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Sessions avec ingénieur (45€/h)
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Mixage (200€/projet)
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Mastering (60€/titre)
                </li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2 text-center italic">Le reste au studio</p>
            </div>
            <div className="p-4 rounded-xl bg-accent/5 border border-accent/20">
              <p className="text-sm font-semibold text-accent mb-2 text-center">Paiement complet</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  Location sèche (22€/h)
                </li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2 text-center italic">À régler à la réservation</p>
            </div>
          </div>
          
          <p className="text-muted-foreground text-center mb-4">
            Forfaits et tarifs dégressifs disponibles pour les projets longs
          </p>
          <div className="text-center">
            <Button variant="outline" size="lg">
              Demander un devis personnalisé
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
