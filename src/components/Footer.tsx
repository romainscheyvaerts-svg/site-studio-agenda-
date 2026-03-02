import { useTranslation } from "react-i18next";
import { Mic, Phone, Mail, MapPin, Share2 } from "lucide-react";
import { useViewMode } from "@/hooks/useViewMode";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const LINKTREE_URL = "https://linktr.ee/StudioMakemusic";

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
                {t("footer.description")}
              </p>
            </div>
            
            {/* Quick contact */}
            <div className="flex justify-center gap-6 text-xs text-muted-foreground">
              <a href="tel:+32476094172" className="flex items-center gap-1.5 hover:text-primary transition-colors">
                <Phone className="w-3.5 h-3.5" />
                {t("footer.call")}
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

            {/* Social Media / Linktree Button */}
            <div className="flex justify-center">
              <Button
                asChild
                className="bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 hover:from-green-600 hover:via-emerald-600 hover:to-teal-600 text-white font-semibold px-6 py-2 rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <a href={LINKTREE_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                  <Share2 className="w-4 h-4" />
                  Nos Réseaux Sociaux
                </a>
              </Button>
            </div>
            
            {/* Copyright */}
            <div className="border-t border-border pt-4 text-center">
              <p className="text-[10px] text-muted-foreground">
                © {new Date().getFullYear()} Make Music. {t("footer.rights")}.
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

              {/* Social Media */}
              <div>
                <h4 className="font-display text-lg text-foreground mb-4">
                  SUIVEZ-NOUS
                </h4>
                <Button
                  asChild
                  className="bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 hover:from-green-600 hover:via-emerald-600 hover:to-teal-600 text-white font-semibold px-6 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 w-full"
                >
                  <a href={LINKTREE_URL} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2">
                    <Share2 className="w-5 h-5" />
                    Nos Réseaux Sociaux
                  </a>
                </Button>
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  Instagram • TikTok • YouTube • Spotify
                </p>
              </div>
            </div>

            <div className="border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-xs text-muted-foreground">
                © {new Date().getFullYear()} Make Music. {t("footer.rights")}.
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
