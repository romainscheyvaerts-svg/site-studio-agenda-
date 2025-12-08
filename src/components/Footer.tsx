import { useTranslation } from "react-i18next";
import { Mic, Instagram, Youtube, Music } from "lucide-react";

const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer className="py-12 border-t border-border bg-secondary/20">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Mic className="w-5 h-5 text-primary" />
              </div>
              <span className="font-display text-2xl text-foreground">MAKE<span className="text-primary">MUSIC</span></span>
            </div>
            <p className="text-muted-foreground text-sm max-w-md mb-4">
              {t("footer.description")}
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                <Youtube className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                <Music className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-display text-lg text-foreground mb-4">{t("nav.services").toUpperCase()}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>{t("pricing.with_engineer.title")}</li>
              <li>{t("pricing.mixing.title")}</li>
              <li>{t("pricing.mastering.title")}</li>
              <li>{t("pricing.without_engineer.title")}</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display text-lg text-foreground mb-4">{t("footer.contact").toUpperCase()}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>prod.makemusic@gmail.com</li>
              <li>+32 476 09 41 72</li>
              <li>Bruxelles, Belgique</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground">
            © 2024 Make Music. {t("footer.rights")}.
          </p>
          <div className="flex gap-6 text-xs text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Mentions légales</a>
            <a href="#" className="hover:text-foreground transition-colors">Politique de confidentialité</a>
            <a href="#" className="hover:text-foreground transition-colors">CGV</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;