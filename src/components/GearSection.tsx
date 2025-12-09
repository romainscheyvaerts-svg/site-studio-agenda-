import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

// Import brand logos
import neumannLogo from "@/assets/logos/neumann-logo.svg";
import sslLogo from "@/assets/logos/ssl-logo.svg";
import genelecLogo from "@/assets/logos/genelec-logo.svg";
import protoolsLogo from "@/assets/logos/protools-logo.svg";
import uadLogo from "@/assets/logos/uad-logo.svg";
import wavesLogo from "@/assets/logos/waves-logo.svg";
import soundtoysLogo from "@/assets/logos/soundtoys-logo.svg";
import antaresLogo from "@/assets/logos/antares-logo.svg";
import slateLogo from "@/assets/logos/slate-logo.svg";

interface GearItem {
  name: string;
  brand: string;
  categoryKey: string;
  descriptionKey: string;
  features: string[];
  logo: string;
}

const GearSection = () => {
  const { t } = useTranslation();
  const [activeGear, setActiveGear] = useState(0);

  const gearData: GearItem[] = [
    {
      name: "U87",
      brand: "NEUMANN",
      categoryKey: "gear.microphone",
      descriptionKey: "gear.microphone_desc",
      features: ["Large diaphragme", "3 directivités", "Son légendaire"],
      logo: neumannLogo,
    },
    {
      name: "Préamp & Console",
      brand: "SSL",
      categoryKey: "gear.preamp",
      descriptionKey: "gear.preamp_desc",
      features: ["Préamp ultra transparent", "EQ légendaire", "Compression VCA"],
      logo: sslLogo,
    },
    {
      name: "Interface Audio",
      brand: "SSL",
      categoryKey: "gear.interface",
      descriptionKey: "gear.interface_desc",
      features: ["Conversion 32-bit", "Latence <1ms", "Thunderbolt"],
      logo: sslLogo,
    },
    {
      name: "Monitors + Sub",
      brand: "GENELEC",
      categoryKey: "gear.monitors",
      descriptionKey: "gear.monitors_desc",
      features: ["Bi-amplifié", "Correction acoustique", "Réponse plate"],
      logo: genelecLogo,
    },
  ];

  const softwareData = [
    { name: "Pro Tools", type: "DAW", logo: protoolsLogo },
    { name: "UAD", type: "Plugins", logo: uadLogo },
    { name: "Waves", type: "Plugins", logo: wavesLogo },
    { name: "Soundtoys", type: "Plugins", logo: soundtoysLogo },
    { name: "Slate Digital", type: "Plugins", logo: slateLogo },
    { name: "Auto-Tune", type: "Antares", logo: antaresLogo },
    { name: "SSL Native", type: "Plugins", logo: sslLogo },
  ];

  return (
    <section id="gear" className="py-24 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px]" />
      
      <div className="container mx-auto px-6">
        {/* Section header */}
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1 rounded-full border border-accent/30 bg-accent/5 text-accent text-sm font-medium mb-4">
            {t("gear.badge")}
          </span>
          <h2 className="font-display text-5xl md:text-7xl text-foreground mb-4">
            {t("gear.title")} <span className="text-primary text-glow-cyan">{t("gear.title_highlight")}</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {t("gear.description")}
          </p>
        </div>

        {/* Hardware Brand Logos Marquee */}
        <div className="mb-12">
          <h4 className="text-center text-sm text-muted-foreground mb-6 uppercase tracking-widest">
            {t("gear.hardware_partners", "Matériel Premium")}
          </h4>
          <div className="flex justify-center items-center gap-8 md:gap-16 flex-wrap">
            {[
              { logo: neumannLogo, name: "Neumann" },
              { logo: sslLogo, name: "SSL" },
              { logo: genelecLogo, name: "Genelec" },
            ].map((brand, index) => (
              <div
                key={index}
                className="group relative px-6 py-4 rounded-xl bg-card/50 border border-border hover:border-primary/50 transition-all duration-300 hover:scale-105"
              >
                <img
                  src={brand.logo}
                  alt={brand.name}
                  className="h-8 md:h-10 w-auto opacity-70 group-hover:opacity-100 transition-opacity filter brightness-0 invert"
                />
                <div className="absolute inset-0 bg-primary/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
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
                  <span className="text-xs text-primary font-medium tracking-wider">{t(item.categoryKey)}</span>
                  <img 
                    src={item.logo} 
                    alt={item.brand}
                    className="h-5 w-auto opacity-60 filter brightness-0 invert"
                  />
                </div>
                <h3 className="font-display text-2xl text-foreground mb-2">{item.brand} {item.name}</h3>
                {activeGear === index && (
                  <div className="animate-fade-in">
                    <p className="text-muted-foreground text-sm mb-4">{t(item.descriptionKey)}</p>
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
              
              {/* Center display with logo */}
              <div className="absolute inset-8 rounded-2xl border border-primary/30 bg-card/50 backdrop-blur-sm flex flex-col items-center justify-center gradient-border">
                <img 
                  src={gearData[activeGear].logo} 
                  alt={gearData[activeGear].brand}
                  className="h-16 md:h-20 w-auto mb-4 filter brightness-0 invert opacity-90"
                />
                <span className="text-sm text-primary mb-2">{t(gearData[activeGear].categoryKey)}</span>
                <span className="font-display text-4xl md:text-5xl text-foreground mb-1">{gearData[activeGear].brand}</span>
                <span className="font-display text-2xl md:text-3xl text-primary text-glow-cyan">{gearData[activeGear].name}</span>
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

        {/* Software section with logos */}
        <div className="border-t border-border pt-12">
          <h3 className="font-display text-2xl text-center text-foreground mb-4">{t("gear.software")} & {t("gear.plugins")}</h3>
          <p className="text-center text-muted-foreground text-sm mb-8 max-w-xl mx-auto">
            {t("gear.plugins_desc", "Les meilleurs plugins de l'industrie pour un son professionnel")}
          </p>
          
          {/* Plugin logos grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
            {softwareData.map((soft, index) => (
              <div
                key={index}
                className="group flex flex-col items-center justify-center p-4 rounded-xl bg-secondary/30 border border-border hover:border-primary/50 hover:bg-card/50 transition-all duration-300"
              >
                <img 
                  src={soft.logo} 
                  alt={soft.name}
                  className="h-8 w-auto mb-2 opacity-60 group-hover:opacity-100 transition-opacity filter brightness-0 invert"
                />
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors text-center">
                  {soft.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default GearSection;
