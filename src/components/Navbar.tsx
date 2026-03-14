import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Menu, X, LogOut, User, Music, ShoppingBag, FolderOpen, Loader2, Users, Calendar, ChevronDown, Search, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useViewMode } from "@/hooks/useViewMode";
import ViewModeToggle from "./ViewModeToggle";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CurrentSessionDriveInfo {
  parentFolderLink: string;
  hasCurrentSession: boolean;
  clientName?: string;
  clientEmail?: string;
  clientFolderLink?: string;
  sessionFolderLink?: string;
  sessionDate?: string;
}

interface ClientFolder {
  id: string;
  client_email: string;
  client_name: string;
  drive_folder_id: string;
  drive_folder_link: string;
  created_at: string;
}

const Navbar = () => {
  const { t } = useTranslation();
  const { user, signOut, session } = useAuth();
  const { isAdmin } = useAdmin();
  const { isMobileView } = useViewMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [currentSessionInfo, setCurrentSessionInfo] = useState<CurrentSessionDriveInfo | null>(null);
  const [isDriveDropdownOpen, setIsDriveDropdownOpen] = useState(false);
  const [clientFolders, setClientFolders] = useState<ClientFolder[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [showClientsList, setShowClientsList] = useState(false);

  const isHomePage = location.pathname === "/";

  // Fetch current session info for admins
  useEffect(() => {
    if (isAdmin && session?.access_token) {
      fetchCurrentSessionInfo();
      fetchClientFolders();
      // Refresh every 5 minutes
      const interval = setInterval(fetchCurrentSessionInfo, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [isAdmin, session?.access_token]);

  const fetchCurrentSessionInfo = async () => {
    if (!session?.access_token) return;
    
    try {
      const { data, error } = await supabase.functions.invoke("get-current-session-drive", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!error && data) {
        setCurrentSessionInfo(data);
      }
    } catch (error) {
      console.error("[DRIVE] Error fetching current session info:", error);
    }
  };

  // Fetch all client folders for admin using Edge function (bypasses RLS)
  const fetchClientFolders = async () => {
    console.log("[DRIVE] fetchClientFolders called - isAdmin:", isAdmin, "hasToken:", !!session?.access_token);
    
    if (!isAdmin || !session?.access_token) {
      console.log("[DRIVE] Skipping fetch - isAdmin:", isAdmin, "hasToken:", !!session?.access_token);
      return;
    }
    
    setIsLoadingClients(true);
    try {
      console.log("[DRIVE] Invoking list-client-drive-folders function...");
      const { data, error } = await supabase.functions.invoke("list-client-drive-folders", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log("[DRIVE] Response - data:", JSON.stringify(data), "error:", error);

      if (error) {
        console.error("[DRIVE] Error fetching client folders:", error);
        return;
      }

      if (data?.success && data?.folders) {
        setClientFolders(data.folders);
        console.log("[DRIVE] Loaded", data.folders.length, "client folders");
      } else if (data?.folders) {
        // Même si success n'est pas true, si folders existe on les prend
        setClientFolders(data.folders);
        console.log("[DRIVE] Loaded (no success flag)", data.folders.length, "client folders");
      } else {
        console.log("[DRIVE] No folders in response:", data);
      }
    } catch (error) {
      console.error("[DRIVE] Error fetching client folders:", error);
    } finally {
      setIsLoadingClients(false);
    }
  };

  // Filter clients based on search query
  const filteredClients = clientFolders.filter(client => {
    const query = clientSearchQuery.toLowerCase();
    return (
      client.client_name?.toLowerCase().includes(query) ||
      client.client_email?.toLowerCase().includes(query)
    );
  });

  // Function to open user's Drive folder (for non-admins)
  const openUserDriveFolder = async (closeMenuAfter = false) => {
    if (!session?.access_token) {
      toast.error("Veuillez vous reconnecter");
      return;
    }

    if (!user?.email) {
      toast.error("Email utilisateur non disponible");
      return;
    }

    setIsLoadingDrive(true);
    
    // On mobile, we need to open the window immediately to avoid popup blocker
    // We'll open a blank page first, then redirect it
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    let newWindow: Window | null = null;
    
    if (isMobile) {
      // Open a loading page immediately to avoid popup blocker
      newWindow = window.open('about:blank', '_blank');
      if (newWindow) {
        newWindow.document.write('<html><body style="background:#0a0a0a;color:white;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><p>Chargement de Google Drive...</p></body></html>');
      }
    }
    
    try {
      console.log("[DRIVE] Fetching folder for user:", user.email);
      
      const { data, error } = await supabase.functions.invoke("get-client-drive-folder", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log("[DRIVE] Response:", { data, error });

      if (error) {
        console.error("[DRIVE] Function error:", error);
        if (newWindow) newWindow.close();
        throw error;
      }

      if (data?.error) {
        console.error("[DRIVE] Response error:", data.error);
        if (newWindow) newWindow.close();
        toast.error(`Erreur: ${data.error}`);
        return;
      }

      if (data?.found && data?.folderLink) {
        console.log("[DRIVE] Opening folder:", data.folderLink);
        if (newWindow) {
          // Redirect the already opened window
          newWindow.location.href = data.folderLink;
        } else {
          // Desktop - open normally
          window.open(data.folderLink, "_blank");
        }
        if (closeMenuAfter) {
          setIsMobileMenuOpen(false);
        }
      } else {
        console.log("[DRIVE] No folder found for email:", data?.clientEmail);
        if (newWindow) newWindow.close();
        toast.info("Aucun dossier Drive trouvé. Un dossier sera créé lors de votre prochaine réservation.");
      }
    } catch (error: unknown) {
      console.error("[DRIVE] Error fetching Drive folder:", error);
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      toast.error(`Impossible d'accéder au dossier Drive: ${errorMessage}`);
    } finally {
      setIsLoadingDrive(false);
    }
  };

  // Admin Drive functions
  const openAllClientsFolder = () => {
    // Use the correct parent folder link (CLOUD CLIENT MAKE MUSIC)
    window.open("https://drive.google.com/drive/folders/1AXGpSHUP0OyY2tWvCk573xb--Dj2jvLh", "_blank");
  };

  const openClientFolder = (folderLink: string) => {
    window.open(folderLink, "_blank");
  };

  const openCurrentClientFolder = () => {
    if (currentSessionInfo?.clientFolderLink) {
      window.open(currentSessionInfo.clientFolderLink, "_blank");
    } else {
      toast.info("Aucune session en cours ou dossier client non trouvé");
    }
  };

  const openCurrentSessionFolder = () => {
    if (currentSessionInfo?.sessionFolderLink) {
      window.open(currentSessionInfo.sessionFolderLink, "_blank");
    } else if (currentSessionInfo?.hasCurrentSession) {
      toast.info("Le dossier de cette session n'existe pas encore");
    } else {
      toast.info("Aucune session en cours");
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

  // Admin Drive Dropdown Button (Desktop)
  const AdminDriveDropdown = () => (
    <DropdownMenu open={isDriveDropdownOpen} onOpenChange={setIsDriveDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          {isLoadingDrive ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FolderOpen className="w-4 h-4" />
          )}
          Drive
          <ChevronDown className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {/* Sub-menu for all clients */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="cursor-pointer">
            <Users className="w-4 h-4 mr-2" />
            <span>Tous les clients</span>
            <span className="ml-auto text-xs text-muted-foreground">
              ({clientFolders.length})
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="w-72 p-0">
              {/* Search input */}
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un client..."
                    value={clientSearchQuery}
                    onChange={(e) => setClientSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-sm"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
              
              {/* Open all clients folder */}
              <DropdownMenuItem 
                onClick={openAllClientsFolder} 
                className="cursor-pointer border-b text-primary"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                <span>Ouvrir dossier principal</span>
              </DropdownMenuItem>
              
              {/* Client list */}
              <ScrollArea className="h-[300px]">
                {isLoadingClients ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                ) : filteredClients.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    {clientSearchQuery ? "Aucun résultat" : "Aucun client"}
                  </div>
                ) : (
                  filteredClients.map((client) => (
                    <DropdownMenuItem
                      key={client.id}
                      onClick={() => openClientFolder(client.drive_folder_link)}
                      className="cursor-pointer py-2"
                    >
                      <FolderOpen className="w-4 h-4 mr-2 flex-shrink-0 text-amber-500" />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate font-medium">
                          {client.client_name || client.client_email}
                        </span>
                        {client.client_name && client.client_name !== client.client_email && (
                          <span className="text-xs text-muted-foreground truncate">
                            {client.client_email}
                          </span>
                        )}
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </ScrollArea>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={openCurrentClientFolder} 
          className="cursor-pointer"
          disabled={!currentSessionInfo?.hasCurrentSession}
        >
          <FolderOpen className="w-4 h-4 mr-2" />
          <div className="flex flex-col">
            <span>Dossier du client</span>
            {currentSessionInfo?.hasCurrentSession && currentSessionInfo?.clientName && (
              <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                {currentSessionInfo.clientName}
              </span>
            )}
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={openCurrentSessionFolder} 
          className="cursor-pointer"
          disabled={!currentSessionInfo?.sessionFolderLink}
        >
          <Calendar className="w-4 h-4 mr-2" />
          <div className="flex flex-col">
            <span>Dossier de la session</span>
            {currentSessionInfo?.sessionDate && (
              <span className="text-xs text-muted-foreground">
                {currentSessionInfo.sessionDate}
              </span>
            )}
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Mobile Admin Drive options
  const MobileAdminDriveOptions = () => (
    <>
      <Button
        variant="outline"
        size="lg"
        className="w-full h-14 text-lg"
        onClick={() => {
          setShowClientsList(!showClientsList);
        }}
      >
        <Users className="w-5 h-5 mr-2" />
        TOUS LES CLIENTS ({clientFolders.length})
        <ChevronDown className={cn("w-4 h-4 ml-auto transition-transform", showClientsList && "rotate-180")} />
      </Button>
      
      {/* Mobile clients list */}
      {showClientsList && (
        <div className="bg-secondary/50 rounded-lg p-3 space-y-2 max-h-[300px] overflow-y-auto">
          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={clientSearchQuery}
              onChange={(e) => setClientSearchQuery(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          
          {/* Open main folder */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-primary"
            onClick={() => {
              openAllClientsFolder();
              setIsMobileMenuOpen(false);
            }}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Ouvrir dossier principal
          </Button>
          
          {/* Client list */}
          {filteredClients.map((client) => (
            <Button
              key={client.id}
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                openClientFolder(client.drive_folder_link);
                setIsMobileMenuOpen(false);
              }}
            >
              <FolderOpen className="w-4 h-4 mr-2 text-amber-500" />
              <span className="truncate">
                {client.client_name || client.client_email}
              </span>
            </Button>
          ))}
          
          {filteredClients.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-2">
              {clientSearchQuery ? "Aucun résultat" : "Aucun client"}
            </p>
          )}
        </div>
      )}
      
      {currentSessionInfo?.hasCurrentSession && (
        <>
          <Button
            variant="outline"
            size="lg"
            className="w-full h-14 text-lg"
            onClick={() => {
              setIsMobileMenuOpen(false);
              openCurrentClientFolder();
            }}
            disabled={!currentSessionInfo?.clientFolderLink}
          >
            <FolderOpen className="w-5 h-5 mr-2" />
            <div className="flex flex-col items-start">
              <span>DOSSIER CLIENT</span>
              {currentSessionInfo?.clientName && (
                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                  {currentSessionInfo.clientName}
                </span>
              )}
            </div>
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full h-14 text-lg"
            onClick={() => {
              setIsMobileMenuOpen(false);
              openCurrentSessionFolder();
            }}
            disabled={!currentSessionInfo?.sessionFolderLink}
          >
            <Calendar className="w-5 h-5 mr-2" />
            <div className="flex flex-col items-start">
              <span>SESSION EN COURS</span>
              {currentSessionInfo?.sessionDate && (
                <span className="text-xs text-muted-foreground">
                  {currentSessionInfo.sessionDate}
                </span>
              )}
            </div>
          </Button>
        </>
      )}
    </>
  );

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
                
                {/* Drive button - different for admin vs regular users */}
                {isAdmin ? (
                  <AdminDriveDropdown />
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openUserDriveFolder()}
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
                )}
                
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
                    
                    {/* Drive options - different for admin vs regular users */}
                    {isAdmin ? (
                      <MobileAdminDriveOptions />
                    ) : (
                      <Button
                        variant="outline"
                        size="lg"
                        className="w-full h-14 text-lg"
                        onClick={() => openUserDriveFolder(true)}
                        disabled={isLoadingDrive}
                      >
                        {isLoadingDrive ? (
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        ) : (
                          <FolderOpen className="w-5 h-5 mr-2" />
                        )}
                        MON DRIVE
                      </Button>
                    )}
                    
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
