import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { Mic, Phone, Mail, MapPin, Instagram, Music2, Youtube, Facebook, Twitter, ExternalLink, Headphones, Music, Cloud } from "lucide-react";
import { useViewMode } from "@/hooks/useViewMode";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface SocialLink {
  id: string;
  platform: string;
  url: string;
  display_name: string | null;
  icon_name: string | null;
  sort_order: number;
  is_active: boolean;
}

const getIcon = (platform: string, className: string = "w-5 h-5") => {
  switch (platform) {
    case "instagram": return <Instagram className={className} />;
    case "tiktok": return <Music2 className={className} />;
    case "youtube": return <Youtube className={className} />;
    case "facebook": return <Facebook className={className} />;
    case "twitter": return <Twitter className={className} />;
    case "spotify": return <Headphones className={className} />;
    case "soundcloud": return <Cloud className={className} />;
    default: return <ExternalLink className={className} />;
  }
};

const getPlatformColor = (platform: string) => {
  switch (platform) {
    case "instagram": return "hover:text-pink-500";
    case "tiktok": return "hover:text-white";
    case "youtube": return "hover:text-red-500";
    case "facebook": return "hover:text-blue-500";
    case "twitter": return "hover:text-sky-400";
    case "spotify": return "hover:text-green-500";
    case "soundcloud": return "hover:text-orange-500";
    default: return "hover:text-primary";
  }
};

const Footer = () => {
  const { t } = useTranslation();
  const { isMobileView } = useViewMode();
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);

  useEffect(() => {
    const fetchSocialLinks = async () => {
      const { data, error } = await supabase
        .from("social_links")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (!error && data) {
        setSocialLinks(data);
      }
    };

    fetchSocialLinks();
  }, []);

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

            {/* Social Links */}
            {socialLinks.length > 0 && (
              <div className="flex justify-center gap-4">
                {socialLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground transition-all duration-300 hover:scale-110",
                      getPlatformColor(link.platform)
                    )}
                    title={link.display_name || link.platform}
                  >
                    {getIcon(link.platform, "w-5 h-5")}
                  </a>
                ))}
              </div>
            )}
            
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
                {socialLinks.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {socialLinks.map((link) => (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground transition-all duration-300 hover:scale-110 hover:bg-muted",
                          getPlatformColor(link.platform)
                        )}
                        title={link.display_name || link.platform}
                      >
                        {getIcon(link.platform, "w-6 h-6")}
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Aucun réseau social configuré
                  </p>
                )}
                {socialLinks.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-3">
                    {socialLinks.map(l => l.platform.charAt(0).toUpperCase() + l.platform.slice(1)).join(" • ")}
                  </p>
                )}
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
