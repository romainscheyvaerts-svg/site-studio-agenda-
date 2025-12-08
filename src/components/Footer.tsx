import { Mic, Instagram, Youtube, Music } from "lucide-react";

const Footer = () => {
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
              <span className="font-display text-2xl text-foreground">STUDIO<span className="text-primary">PRO</span></span>
            </div>
            <p className="text-muted-foreground text-sm max-w-md mb-4">
              Studio d'enregistrement professionnel équipé du meilleur matériel : 
              Neumann U87, SSL, Genelec. Votre son mérite l'excellence.
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
            <h4 className="font-display text-lg text-foreground mb-4">SERVICES</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Enregistrement</li>
              <li>Mixage</li>
              <li>Mastering</li>
              <li>Location Studio</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display text-lg text-foreground mb-4">CONTACT</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>contact@studiopro.fr</li>
              <li>+33 6 XX XX XX XX</li>
              <li>Paris, France</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground">
            © 2024 StudioPro. Tous droits réservés.
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
