import { useTranslation } from "react-i18next";
import { Mic } from "lucide-react";
import { useViewMode } from "@/hooks/useViewMode";
import { cn } from "@/lib/utils";

const Footer = () => {
  const { t } = useTranslation();
  const { isMobileView } = useViewMode();

  return (
    <footer className={cn("border-t border-border bg-secondary/20", isMobileView ? "py-8" : "py-12")}>
      <div className={cn("container mx-auto", isMobileView ? "px-4" : "px-6")}>
        <div className={cn("gap-8 mb-8", isMobileView ? "space-y-6" : "grid md:grid-cols-4")}>
          {/* Brand */}
          <div className={isMobileView ? "" : "md:col-span-2"}>
            <div className={cn("flex items-center gap-2 mb-4", isMobileView && "justify-center")}>
              <div className={cn(
                "rounded-lg bg-primary/20 flex items-center justify-center",
                isMobileView ? "w-8 h-8" : "w-10 h-10"
              )}>
                <Mic className={cn("text-primary", isMobileView ? "w-4 h-4" : "w-5 h-5")} />
              </div>
              <span className={cn("font-display text-foreground", isMobileView ? "text-xl" : "text-2xl")}>
                MAKE<span className="text-primary">MUSIC</span>
              </span>
            </div>
            <p className={cn(
              "text-muted-foreground max-w-md mb-4",
              isMobileView ? "text-xs text-center" : "text-sm"
            )}>
              {t("footer.description")}
            </p>
          </div>

          {/* Services & Contact - side by side on mobile */}
          <div className={cn(isMobileView && "grid grid-cols-2 gap-4")}>
            {/* Services */}
            <div className={isMobileView ? "" : "mb-0"}>
              <h4 className={cn(
                "font-display text-foreground mb-3",
                isMobileView ? "text-sm" : "text-lg mb-4"
              )}>
                {t("nav.services").toUpperCase()}
              </h4>
              <ul className={cn("space-y-1 text-muted-foreground", isMobileView ? "text-xs" : "text-sm space-y-2")}>
                <li>{t("pricing.with_engineer.title")}</li>
                <li>{t("pricing.mixing.title")}</li>
                <li>{t("pricing.mastering.title")}</li>
                <li>{t("pricing.without_engineer.title")}</li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className={cn(
                "font-display text-foreground mb-3",
                isMobileView ? "text-sm" : "text-lg mb-4"
              )}>
                {t("footer.contact").toUpperCase()}
              </h4>
              <ul className={cn("space-y-1 text-muted-foreground", isMobileView ? "text-xs" : "text-sm space-y-2")}>
                <li className={isMobileView ? "break-all" : ""}>prod.makemusic@gmail.com</li>
                <li>+32 476 09 41 72</li>
                <li>Bruxelles, Belgique</li>
              </ul>
            </div>
          </div>
        </div>

        <div className={cn(
          "border-t border-border flex flex-col items-center gap-4",
          isMobileView ? "pt-6" : "pt-8 md:flex-row justify-between"
        )}>
          <p className={cn("text-muted-foreground", isMobileView ? "text-[10px]" : "text-xs")}>
            © 2024 Make Music. {t("footer.rights")}.
          </p>
          <div className={cn("flex gap-4 text-muted-foreground", isMobileView ? "text-[10px] gap-3" : "text-xs gap-6")}>
            <a href="#" className="hover:text-foreground transition-colors">Mentions légales</a>
            <a href="#" className="hover:text-foreground transition-colors">Confidentialité</a>
            <a href="#" className="hover:text-foreground transition-colors">CGV</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
export default Footer;