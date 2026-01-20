import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Menu, X, Mic, LogOut, User, Music, ShoppingBag, FolderOpen, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useAuth } from "@/hooks/useAuth";
import { useViewMode } from "@/hooks/useViewMode";
import ViewModeToggle from "./ViewModeToggle";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Navbar = () => {
  const { t } = useTranslation();
  const { user, signOut, session } = useAuth();
  const { isMobileView } = useViewMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);

  const isHomePage = location.pathname === "/";

  // Function to open user's Drive folder
  const openDriveFolder = async () => {
    if (!session?.access_token) {
      toast.error("Veuillez vous reconnecter");
      return;
    }

    setIsLoadingDrive(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-client-drive-folder", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.found && data?.folderLink) {
        window.open(data.folderLink, "_blank");
      } else {
        toast.info("Aucun dossier Drive trouvé. Un dossier sera créé lors de votre prochaine réservation.");
      }
    } catch (error) {
      console.error("Error fetching Drive folder:", error);
      toast.error("Impossible d'accéder au dossier Drive");
    } finally {
      setIsLoadingDrive(false);
    }
  };
  
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const goToPage = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  const navLinks = [
    { label: t("nav.home"), path: "/" },
    { label: t("nav.gear"), path: "/arsenal" },
    { label: t("nav.pricing"), path: "/offres" },
    { label: t("nav.booking"), path: "/reservation" },
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
                key={link.path}
                onClick={() => goToPage(link.path)}
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
              {t("nav.instrumentals")}
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => goToPage("/mes-achats")}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                >
                  <ShoppingBag className="w-4 h-4" />
                  Mes Achats
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openDriveFolder}
                  disabled={isLoadingDrive}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                  title="Accéder à mon dossier Google Drive"
                >
                  {isLoadingDrive ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FolderOpen className="w-4 h-4" />
                  )}
                  Mon Drive
                </Button>
                <Button variant="neon" onClick={() => goToPage("/reservation")}>
                  {t("nav.booking").toUpperCase()}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={signOut}
                  title={t("auth.logout")}
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
                  {t("auth.login")}
                </Button>
                <Button variant="neon" onClick={() => goToPage("/reservation")}>
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

        {/* Mobile menu - Full screen overlay */}
        {isMobileMenuOpen && (
          <div className={cn(
            "fixed inset-0 top-16 z-50 animate-fade-in overflow-y-auto",
            "bg-[hsl(222,47%,6%)]", // Solid opaque background
            isMobileView ? "block" : "md:hidden block"
          )}>
            <div className="container mx-auto px-6 py-6">
              <div className="flex flex-col gap-2">
                {navLinks.map((link) => (
                  <button
                    key={link.path}
                    onClick={() => goToPage(link.path)}
                    className="text-left text-foreground hover:text-primary transition-colors py-4 text-xl font-display border-b border-border/50"
                  >
                    {link.label.toUpperCase()}
                  </button>
                ))}
                <button
                  onClick={() => {
                    navigate("/instrumentals");
                    setIsMobileMenuOpen(false);
                  }}
                  className="text-left text-foreground hover:text-primary transition-colors py-4 flex items-center gap-3 text-xl font-display border-b border-border/50"
                >
                  <Music className="h-5 w-5 text-accent" />
                  {t("nav.instrumentals").toUpperCase()}
                </button>
              </div>
              
              <div className="flex flex-col gap-3 mt-8">
                <Button
                  variant="hero"
                  size="lg"
                  className="w-full h-14 text-lg"
                  onClick={() => goToPage("/reservation")}
                >
                  {t("nav.booking").toUpperCase()}
                </Button>
                {user ? (
                  <>
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full h-14 text-lg"
                      onClick={() => goToPage("/mes-achats")}
                    >
                      <ShoppingBag className="w-5 h-5 mr-2" />
                      MES ACHATS
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full h-14 text-lg"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        openDriveFolder();
                      }}
                      disabled={isLoadingDrive}
                    >
                      {isLoadingDrive ? (
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      ) : (
                        <FolderOpen className="w-5 h-5 mr-2" />
                      )}
                      MON DRIVE
                    </Button>
                    <Button
                      variant="ghost"
                      size="lg"
                      className="w-full h-14 text-lg text-muted-foreground"
                      onClick={signOut}
                    >
                      <LogOut className="w-5 h-5 mr-2" />
                      {t("auth.logout")}
                    </Button>
                  </>
                ) : (
                  <Button 
                    variant="outline" 
                    size="lg"
                    className="w-full h-14 text-lg"
                    onClick={() => {
                      navigate("/auth");
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    <User className="w-5 h-5 mr-2" />
                    {t("auth.login")} / {t("auth.signup")}
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