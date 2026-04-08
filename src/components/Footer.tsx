import { useTranslation } from "react-i18next";
import { Mic, Phone, Mail, MapPin, ExternalLink } from "lucide-react";
import { useViewMode } from "@/hooks/useViewMode";
import { useStudio } from "@/hooks/useStudio";
import { cn } from "@/lib/utils";
import { DEFAULT_STUDIO_NAME, STUDIO_PHONE, STUDIO_EMAIL, STUDIO_LOCATION, STUDIO_LOCATION_FULL, SOCIAL_LINKS_URL } from "@/config/constants";

const Footer = () => {
  const { t } = useTranslation();
  const { isMobileView } = useViewMode();
  const { studio } = useStudio();
  const studioName = studio?.name || DEFAULT_STUDIO_NAME;

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
                  {(() => {
                    const words = studioName.toUpperCase().split(" ");
                    if (words.length > 1) return <>{words[0]}<span className="text-primary">{words.slice(1).join(" ")}</span></>;
                    return <span className="text-primary">{words[0]}</span>;
                  })()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {studio?.description || t("footer.description")}
              </p>
            </div>
            
            {/* Quick contact */}
            <div className="flex justify-center gap-6 text-xs text-muted-foreground">
              <a href={`tel:${STUDIO_PHONE}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                <Phone className="w-3.5 h-3.5" />
                {t("footer.call")}
              </a>
              <a href={`mailto:${STUDIO_EMAIL}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                <Mail className="w-3.5 h-3.5" />
                Email
              </a>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {STUDIO_LOCATION}
              </span>
            </div>

            {/* Social Links */}
            <div className="flex justify-center">
              <a
                href={SOCIAL_LINKS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition-all duration-300 hover:scale-105 text-sm font-medium"
              >
                <ExternalLink className="w-4 h-4" />
                Réseaux sociaux
              </a>
            </div>
            
            {/* Copyright */}
            <div className="border-t border-border pt-4 text-center">
              <p className="text-[10px] text-muted-foreground">
                © {new Date().getFullYear()} {studioName}. {t("footer.rights")}.
              </p>
            </div>
          </div>
        ) : (
          // Desktop Footer
          <>
            <div className="grid gap-8 mb-8 md:grid-cols-4">
              {/* Brand */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Mic className="w-5 h-5 text-primary" />
                  </div>
                  <span className="font-display text-2xl text-foreground">
                    {(() => {
                      const words = studioName.toUpperCase().split(" ");
                      if (words.length > 1) return <>{words[0]}<span className="text-primary">{words.slice(1).join(" ")}</span></>;
                      return <span className="text-primary">{words[0]}</span>;
                    })()}
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
                  <li>{STUDIO_EMAIL}</li>
                  <li>{STUDIO_LOCATION_FULL}</li>
                </ul>
              </div>

              {/* Social Media */}
              <div>
                <h4 className="font-display text-lg text-foreground mb-4">
                  SUIVEZ-NOUS
                </h4>
                <a
                  href={SOCIAL_LINKS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-primary/20 text-primary hover:bg-primary/30 transition-all duration-300 hover:scale-105 font-medium"
                >
                  <ExternalLink className="w-5 h-5" />
                  Réseaux sociaux
                </a>
              </div>
            </div>

            <div className="border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-xs text-muted-foreground">
                © {new Date().getFullYear()} {studioName}. {t("footer.rights")}.
              </p>
              <div className="flex gap-6 text-xs text-muted-foreground">
                <a href="#" className="hover:text-foreground transition-colors">{t("footer.legal")}</a>
                <a href="#" className="hover:text-foreground transition-colors">{t("footer.privacy")}</a>
                <a href="#" className="hover:text-foreground transition-colors">{t("footer.terms")}</a>
              </div>
            </div>
          </>
        )}
      </div>
    </footer>
  );
};

export default Footer;
