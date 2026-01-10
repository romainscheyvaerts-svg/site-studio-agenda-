import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useViewMode } from "@/hooks/useViewMode";

interface GearItem {
  name: string;
  brand: string;
  categoryKey: string;
  descriptionKey: string;
  features: string[];
}

const GearSection = () => {
  const { t } = useTranslation();
  const { isMobileView } = useViewMode();
  const [activeGear, setActiveGear] = useState(0);

  const gearData: GearItem[] = [
    {
      name: "U87",
      brand: "NEUMANN",
      categoryKey: "gear.microphone",
      descriptionKey: "gear.microphone_desc",
      features: ["Large diaphragme", "3 directivités", "Son légendaire"],
    },
    {
      name: "Préampli",
      brand: "SSL",
      categoryKey: "gear.preamp",
      descriptionKey: "gear.preamp_desc",
      features: ["Préamp ultra transparent", "EQ légendaire", "Compression VCA"],
    },
    {
      name: "Interface Audio",
      brand: "SSL",
      categoryKey: "gear.interface",
      descriptionKey: "gear.interface_desc",
      features: ["Conversion 32-bit", "Latence <1ms", "Thunderbolt"],
    },
    {
      name: "Monitors + Sub",
      brand: "GENELEC",
      categoryKey: "gear.monitors",
      descriptionKey: "gear.monitors_desc",
      features: ["Bi-amplifié", "Correction acoustique", "Réponse plate"],
    },
  ];

  const softwareData = [
    { name: "Pro Tools", type: "DAW" },
    { name: "UAD", type: "Plugins" },
    { name: "Waves", type: "Plugins" },
    { name: "Soundtoys", type: "Plugins" },
    { name: "Slate Digital", type: "Plugins" },
    { name: "Auto-Tune", type: "Antares" },
    { name: "SSL Native", type: "Plugins" },
  ];

  return (
    <section id="gear" className={cn("relative overflow-hidden", isMobileView ? "py-12" : "py-24")}>
      {/* Background effects */}
      <div className={cn(
        "absolute top-0 right-0 bg-primary/5 rounded-full blur-[150px]",
        isMobileView ? "w-[300px] h-[300px]" : "w-[600px] h-[600px]"
      )} />
      
      <div className={cn("container mx-auto", isMobileView ? "px-4" : "px-6")}>
        {/* Section header */}
        <div className={cn("text-center", isMobileView ? "mb-8" : "mb-16")}>
          <span className={cn(
            "inline-block px-4 py-1 rounded-full border border-accent/30 bg-accent/5 text-accent font-medium mb-4",
            isMobileView ? "text-xs" : "text-sm"
          )}>
            {t("gear.badge")}
          </span>
          <h2 className={cn("font-display text-foreground mb-4", isMobileView ? "text-3xl" : "text-5xl md:text-7xl")}>
            {t("gear.title")} <span className="text-primary text-glow-cyan">{t("gear.title_highlight")}</span>
          </h2>
          <p className={cn("text-muted-foreground max-w-xl mx-auto", isMobileView ? "text-sm" : "text-base")}>
            {t("gear.description")}
          </p>
        </div>

        {/* Gear grid - full width, centered */}
        <div className={cn("mx-auto", isMobileView ? "mb-8" : "max-w-4xl mb-16")}>
          <div className={cn("gap-4", isMobileView ? "space-y-3" : "grid md:grid-cols-2")}>
            {gearData.map((item, index) => (
              <div
                key={index}
                className={cn(
                  "rounded-xl transition-all duration-300",
                  "bg-card border border-primary/30 box-glow-cyan",
                  isMobileView ? "p-4" : "p-6"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={cn("text-primary font-medium tracking-wider", isMobileView ? "text-[10px]" : "text-xs")}>
                    {t(item.categoryKey)}
                  </span>
                  <span className={cn("text-accent font-bold", isMobileView ? "text-[10px]" : "text-xs")}>{item.brand}</span>
                </div>
                <h3 className={cn("font-display text-foreground mb-2", isMobileView ? "text-lg" : "text-2xl mb-3")}>
                  {item.brand} {item.name}
                </h3>
                <p className={cn("text-muted-foreground mb-3", isMobileView ? "text-xs" : "text-sm mb-4")}>
                  {t(item.descriptionKey)}
                </p>
                <div className="flex flex-wrap gap-2">
                  {item.features.map((feature, i) => (
                    <span key={i} className={cn(
                      "px-2 py-1 rounded-full bg-primary/10 text-primary",
                      isMobileView ? "text-[10px]" : "text-xs px-3"
                    )}>
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Software section */}
        <div className={cn("border-t border-border", isMobileView ? "pt-8" : "pt-12")}>
          <h3 className={cn("font-display text-center text-foreground mb-4", isMobileView ? "text-xl" : "text-2xl")}>
            {t("gear.software")} & {t("gear.plugins")}
          </h3>
          <p className={cn("text-center text-muted-foreground mb-6 max-w-xl mx-auto", isMobileView ? "text-xs" : "text-sm mb-8")}>
            {t("gear.plugins_desc", "Les meilleurs plugins de l'industrie pour un son professionnel")}
          </p>
          
          {/* Plugin tags */}
          <div className={cn("flex flex-wrap justify-center", isMobileView ? "gap-2" : "gap-3")}>
            {softwareData.map((soft, index) => (
              <div
                key={index}
                className={cn(
                  "rounded-xl bg-secondary/30 border border-border hover:border-primary/50 hover:bg-card/50 transition-all duration-300",
                  isMobileView ? "px-3 py-2" : "px-5 py-3"
                )}
              >
                <span className={cn("font-medium text-foreground", isMobileView ? "text-xs" : "text-sm")}>{soft.name}</span>
                <span className={cn("text-muted-foreground ml-1", isMobileView ? "text-[10px]" : "text-xs ml-2")}>
                  ({soft.type})
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
