import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Menu, X, Mic, LogOut, User, Music } from "lucide-react";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useAuth } from "@/hooks/useAuth";
import { useViewMode } from "@/hooks/useViewMode";
import ViewModeToggle from "./ViewModeToggle";

const Navbar = () => {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { isMobileView } = useViewMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const isHomePage = location.pathname === "/";
  
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    if (!isHomePage) {
      navigate("/");
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }
    setIsMobileMenuOpen(false);
  };

  const navLinks = [
    { label: t("nav.home"), id: "hero" },
    { label: t("nav.gear"), id: "gear" },
    { label: t("nav.pricing"), id: "pricing" },
    { label: t("nav.booking"), id: "booking" },
  ];

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isScrolled
          ? "bg-background/80 backdrop-blur-lg border-b border-border"
          : "bg-transparent"
      )}
    >
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-display text-foreground",
              isMobileView ? "text-xl" : "text-2xl"
            )}>
              MAKE<span className="text-primary">MUSIC</span>
            </span>
          </div>

          {/* Desktop nav - hidden when mobile view is forced */}
          <div className={cn(
            "items-center gap-8",
            isMobileView ? "hidden" : "hidden md:flex"
          )}>
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollTo(link.id)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors relative group"
              >
                {link.label}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full" />
              </button>
            ))}
            <button
              onClick={() => navigate("/instrumentals")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors relative group flex items-center gap-1"
            >
              <Music className="h-4 w-4" />
              Instrumentaux
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-neon-gold transition-all duration-300 group-hover:w-full" />
            </button>
          </div>

          {/* Language switcher & Auth/CTA - Desktop only */}
          <div className={cn(
            "items-center gap-4",
            isMobileView ? "hidden" : "hidden md:flex"
          )}>
            <ViewModeToggle />
            <LanguageSwitcher />
            {user ? (
              <>
                <Button variant="neon" onClick={() => scrollTo("booking")}>
                  {t("nav.booking").toUpperCase()}
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={signOut}
                  title="Déconnexion"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => navigate("/auth")}
                  className="flex items-center gap-2"
                >
                  <User className="w-4 h-4" />
                  Connexion
                </Button>
                <Button variant="neon" onClick={() => scrollTo("booking")}>
                  {t("nav.booking").toUpperCase()}
                </Button>
              </>
            )}
          </div>

          {/* Mobile menu button - shown when mobile view is forced OR on small screens */}
          <div className={cn(
            "flex items-center gap-2",
            isMobileView ? "flex" : "md:hidden flex"
          )}>
            <ViewModeToggle />
            <LanguageSwitcher />
            <button
              className="text-foreground"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu - shown when mobile menu is open AND (mobile view forced OR small screen) */}
        {isMobileMenuOpen && (
          <div className={cn(
            "py-4 border-t border-border animate-fade-in",
            isMobileView ? "block" : "md:hidden block"
          )}>
            <div className="flex flex-col gap-3">
              {navLinks.map((link) => (
                <button
                  key={link.id}
                  onClick={() => scrollTo(link.id)}
                  className="text-left text-muted-foreground hover:text-foreground transition-colors py-2 text-base"
                >
                  {link.label}
                </button>
              ))}
              <button
                onClick={() => {
                  navigate("/instrumentals");
                  setIsMobileMenuOpen(false);
                }}
                className="text-left text-muted-foreground hover:text-foreground transition-colors py-2 flex items-center gap-2 text-base"
              >
                <Music className="h-4 w-4" />
                Instrumentaux
              </button>
              <div className="flex flex-col gap-2 mt-2">
                <Button variant="neon" size="lg" className="w-full" onClick={() => scrollTo("booking")}>
                  {t("nav.booking").toUpperCase()}
                </Button>
                {user ? (
                  <Button 
                    variant="outline" 
                    size="lg"
                    className="w-full"
                    onClick={signOut}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Déconnexion
                  </Button>
                ) : (
                  <Button 
                    variant="outline" 
                    size="lg"
                    className="w-full"
                    onClick={() => {
                      navigate("/auth");
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    <User className="w-4 h-4 mr-2" />
                    Connexion / Inscription
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;