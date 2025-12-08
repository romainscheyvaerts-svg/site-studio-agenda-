import { useState } from "react";
import { cn } from "@/lib/utils";

interface GearItem {
  name: string;
  brand: string;
  category: string;
  description: string;
  features: string[];
}

const gearData: GearItem[] = [
  {
    name: "U87",
    brand: "NEUMANN",
    category: "Microphone",
    description: "Le micro de référence mondiale pour la voix et les instruments. Utilisé sur 90% des productions professionnelles.",
    features: ["Large diaphragme", "3 directivités", "Son légendaire"],
  },
  {
    name: "Préamp & Console",
    brand: "SSL",
    category: "Préamplification",
    description: "La chaîne SSL offre une clarté et une chaleur incomparables. Le standard de l'industrie musicale.",
    features: ["Préamp ultra transparent", "EQ légendaire", "Compression VCA"],
  },
  {
    name: "Interface Audio",
    brand: "SSL",
    category: "Conversion",
    description: "Conversion A/D et D/A de qualité studio. Latence ultra-faible pour un monitoring parfait.",
    features: ["Conversion 32-bit", "Latence <1ms", "Connexion Thunderbolt"],
  },
  {
    name: "Monitors + Sub Genelec",
    brand: "GENELEC",
    category: "Monitoring",
    description: "Système de monitoring actif avec correction de pièce SAM™. Précision chirurgicale du mix.",
    features: ["Bi-amplifié", "Correction acoustique", "Réponse plate"],
  },
];

const softwareData = [
  { name: "Pro Tools", type: "DAW" },
  { name: "UAD", type: "Plugins" },
  { name: "Waves", type: "Plugins" },
  { name: "Soundtoys", type: "Plugins" },
  { name: "Auto-Tune", type: "Antares" },
  { name: "SSL Native", type: "Plugins" },
];

const GearSection = () => {
  const [activeGear, setActiveGear] = useState(0);

  return (
    <section id="gear" className="py-24 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px]" />
      
      <div className="container mx-auto px-6">
        {/* Section header */}
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1 rounded-full border border-accent/30 bg-accent/5 text-accent text-sm font-medium mb-4">
            ÉQUIPEMENT PREMIUM
          </span>
          <h2 className="font-display text-5xl md:text-7xl text-foreground mb-4">
            NOTRE <span className="text-primary text-glow-cyan">ARSENAL</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Du matériel haut de gamme pour une qualité sonore irréprochable
          </p>
        </div>

        {/* Gear grid */}
        <div className="grid lg:grid-cols-2 gap-8 mb-16">
          {/* Left: Gear selector */}
          <div className="space-y-4">
            {gearData.map((item, index) => (
              <div
                key={index}
                onClick={() => setActiveGear(index)}
                className={cn(
                  "p-6 rounded-xl cursor-pointer transition-all duration-300",
                  activeGear === index
                    ? "bg-card border border-primary/50 box-glow-cyan"
                    : "bg-secondary/30 border border-border hover:border-primary/30"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-primary font-medium tracking-wider">{item.category}</span>
                  <span className="text-sm text-muted-foreground">{item.brand}</span>
                </div>
                <h3 className="font-display text-2xl text-foreground mb-2">{item.brand} {item.name}</h3>
                {activeGear === index && (
                  <div className="animate-fade-in">
                    <p className="text-muted-foreground text-sm mb-4">{item.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {item.features.map((feature, i) => (
                        <span key={i} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs">
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Right: Visual display */}
          <div className="relative flex items-center justify-center">
            <div className="relative w-full aspect-square max-w-md">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-radial from-primary/20 via-transparent to-transparent animate-pulse-slow" />
              
              {/* Center display */}
              <div className="absolute inset-8 rounded-2xl border border-primary/30 bg-card/50 backdrop-blur-sm flex flex-col items-center justify-center gradient-border">
                <span className="text-sm text-primary mb-2">{gearData[activeGear].category}</span>
                <span className="font-display text-5xl text-foreground mb-1">{gearData[activeGear].brand}</span>
                <span className="font-display text-3xl text-primary text-glow-cyan">{gearData[activeGear].name}</span>
              </div>

              {/* Orbiting elements */}
              <div className="absolute inset-0 animate-spin" style={{ animationDuration: '30s' }}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary shadow-[0_0_15px_hsl(var(--neon-cyan))]" />
              </div>
              <div className="absolute inset-0 animate-spin" style={{ animationDuration: '25s', animationDirection: 'reverse' }}>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-accent shadow-[0_0_15px_hsl(var(--neon-gold))]" />
              </div>
            </div>
          </div>
        </div>

        {/* Software section */}
        <div className="border-t border-border pt-12">
          <h3 className="font-display text-2xl text-center text-foreground mb-8">LOGICIELS & PLUGINS</h3>
          <div className="flex flex-wrap justify-center gap-4">
            {softwareData.map((soft, index) => (
              <div
                key={index}
                className="px-6 py-3 rounded-lg bg-secondary/50 border border-border hover:border-primary/50 transition-colors"
              >
                <span className="font-medium text-foreground">{soft.name}</span>
                <span className="text-xs text-muted-foreground ml-2">({soft.type})</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default GearSection;
