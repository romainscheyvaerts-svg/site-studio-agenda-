import { useTranslation } from "react-i18next";
import { Mic, Phone, Mail, MapPin } from "lucide-react";
import { useViewMode } from "@/hooks/useViewMode";
import { cn } from "@/lib/utils";

const Footer = () => {
  const { t } = useTranslation();
  const { isMobileView } = useViewMode();

  return (
    <footer className={cn("border-t border-border bg-secondary/20", isMobileView ? "py-6" : "py-12")}>
      <div className={cn("container mx-auto", isMobileView ? "px-5" : "px-6")}>
        {isMobileView ? (
          // Mobile Footer - Compact version
          <div className="space-y-6">
            {/* Brand */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Mic className="w-4 h-4 text-primary" />
                </div>
                <span className="font-display text-xl text-foreground">
                  MAKE<span className="text-primary">MUSIC</span>
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Studio d'enregistrement professionnel
              </p>
            </div>
            
            {/* Quick contact */}
            <div className="flex justify-center gap-6 text-xs text-muted-foreground">
              <a href="tel:+32476094172" className="flex items-center gap-1.5 hover:text-primary transition-colors">
                <Phone className="w-3.5 h-3.5" />
                Appeler
              </a>
              <a href="mailto:prod.makemusic@gmail.com" className="flex items-center gap-1.5 hover:text-primary transition-colors">
                <Mail className="w-3.5 h-3.5" />
                Email
              </a>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                Bruxelles
              </span>
            </div>
            
            {/* Copyright */}
            <div className="border-t border-border pt-4 text-center">
              <p className="text-[10px] text-muted-foreground">
                © 2024 Make Music. Tous droits réservés.
              </p>
            </div>
          </div>
        ) : (
          // Desktop Footer
          <>
            <div className="grid md:grid-cols-4 gap-8 mb-8">
              {/* Brand */}
              <div className="md:col-span-2">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Mic className="w-5 h-5 text-primary" />
                  </div>
                  <span className="font-display text-2xl text-foreground">
                    MAKE<span className="text-primary">MUSIC</span>
                  </span>
                </div>
                <p className="text-sm text-muted-foreground max-w-md mb-4">
                  {t("footer.description")}
                </p>
              </div>

              {/* Services */}
              <div>
                <h4 className="font-display text-lg text-foreground mb-4">
                  {t("nav.services").toUpperCase()}
                </h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>{t("pricing.with_engineer.title")}</li>
                  <li>{t("pricing.mixing.title")}</li>
                  <li>{t("pricing.mastering.title")}</li>
                  <li>{t("pricing.without_engineer.title")}</li>
                </ul>
              </div>

              {/* Contact */}
              <div>
                <h4 className="font-display text-lg text-foreground mb-4">
                  {t("footer.contact").toUpperCase()}
                </h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>prod.makemusic@gmail.com</li>
                  <li>+32 476 09 41 72</li>
                  <li>Bruxelles, Belgique</li>
                </ul>
              </div>
            </div>

            <div className="border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-xs text-muted-foreground">
                © 2024 Make Music. {t("footer.rights")}.
              </p>
              <div className="flex gap-6 text-xs text-muted-foreground">
                <a href="#" className="hover:text-foreground transition-colors">Mentions légales</a>
                <a href="#" className="hover:text-foreground transition-colors">Confidentialité</a>
                <a href="#" className="hover:text-foreground transition-colors">CGV</a>
              </div>
            </div>
          </>
        )}
      </div>
    </footer>
  );
};

export default Footer;