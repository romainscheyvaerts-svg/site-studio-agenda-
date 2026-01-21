import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Mic, Phone, Mail, MapPin, FolderOpen, Search, Calendar, HardDrive } from "lucide-react";
import { useViewMode } from "@/hooks/useViewMode";
import { useAdmin } from "@/hooks/useAdmin";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ClientDriveFolder {
  id: string;
  client_email: string;
  client_name: string;
  drive_folder_link: string;
}

interface TodayBookingInfo {
  client_email: string;
  session_type: string;
  start_time: string;
}

const SESSION_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  "with-engineer": { label: "Session", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  "with_engineer": { label: "Session", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  "without-engineer": { label: "Location", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  "without_engineer": { label: "Location", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  "mixing": { label: "Mix", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  "mastering": { label: "Master", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  "analog-mastering": { label: "Analog", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  "analog_mastering": { label: "Analog", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  "podcast": { label: "Podcast", color: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
};

const Footer = () => {
  const { t } = useTranslation();
  const { isMobileView } = useViewMode();
  const { isAdmin } = useAdmin();

  // Admin Drive state
  const [driveFolders, setDriveFolders] = useState<ClientDriveFolder[]>([]);
  const [todayBookings, setTodayBookings] = useState<TodayBookingInfo[]>([]);
  const [driveSearchTerm, setDriveSearchTerm] = useState("");

  // Fetch drive folders for admin
  useEffect(() => {
    if (!isAdmin) return;

    const fetchDriveFolders = async () => {
      try {
        const { data: folders } = await supabase
          .from("client_drive_folders")
          .select("id, client_email, client_name, drive_folder_link")
          .order("client_name");

        const today = new Date().toISOString().split("T")[0];
        const { data: bookings } = await supabase
          .from("bookings")
          .select("client_email, session_type, start_time")
          .eq("session_date", today)
          .in("status", ["confirmed", "pending"]);

        setDriveFolders(folders || []);
        setTodayBookings(bookings || []);
      } catch (err) {
        console.error("Failed to fetch drive folders:", err);
      }
    };

    fetchDriveFolders();
  }, [isAdmin]);

  // Drive helpers
  const getTodaySessionForClient = (clientEmail: string): TodayBookingInfo | undefined => {
    return todayBookings.find(
      (b) => b.client_email.toLowerCase() === clientEmail.toLowerCase()
    );
  };

  const getSessionTypeConfig = (sessionType: string) => {
    const normalizedType = sessionType.replace(/_/g, "-");
    return SESSION_TYPE_CONFIG[normalizedType] || SESSION_TYPE_CONFIG[sessionType] || {
      label: sessionType,
      color: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    };
  };

  const filteredDriveFolders = driveFolders
    .filter((folder) => {
      const search = driveSearchTerm.toLowerCase();
      return (
        folder.client_name.toLowerCase().includes(search) ||
        folder.client_email.toLowerCase().includes(search)
      );
    })
    .sort((a, b) => {
      const aHasSession = getTodaySessionForClient(a.client_email);
      const bHasSession = getTodaySessionForClient(b.client_email);
      if (aHasSession && !bHasSession) return -1;
      if (!aHasSession && bHasSession) return 1;
      return a.client_name.localeCompare(b.client_name);
    });

  const clientsWithTodaySession = filteredDriveFolders.filter((f) =>
    getTodaySessionForClient(f.client_email)
  );
  const otherClients = filteredDriveFolders.filter(
    (f) => !getTodaySessionForClient(f.client_email)
  );

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
            
            {/* Copyright */}
            <div className="border-t border-border pt-4 text-center">
              <p className="text-[10px] text-muted-foreground">
                © 2024 Make Music. {t("footer.rights")}.
              </p>
            </div>
          </div>
        ) : (
          // Desktop Footer
          <>
            <div className={cn("grid gap-8 mb-8", isAdmin ? "md:grid-cols-5" : "md:grid-cols-4")}>
              {/* Brand */}
              <div className={isAdmin ? "md:col-span-1" : "md:col-span-2"}>
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

              {/* Admin Drive Section */}
              {isAdmin && (
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-display text-lg text-foreground flex items-center gap-2">
                      <FolderOpen className="w-5 h-5 text-primary" />
                      DRIVE CLIENTS
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1"
                      onClick={() => window.open("https://drive.google.com/drive/folders/1AXGpSHUP0OyY2tWvCk573xb--Dj2jvLh", "_blank")}
                    >
                      <HardDrive className="w-3 h-3" />
                      Drive
                    </Button>
                  </div>

                  {/* Search */}
                  <div className="relative mb-3">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher un client..."
                      value={driveSearchTerm}
                      onChange={(e) => setDriveSearchTerm(e.target.value)}
                      className="pl-8 h-8 text-sm bg-background/50"
                    />
                  </div>

                  {/* Today's sessions */}
                  {clientsWithTodaySession.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-amber-400 mb-2 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Aujourd'hui ({clientsWithTodaySession.length})
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {clientsWithTodaySession.map((folder) => {
                          const session = getTodaySessionForClient(folder.client_email)!;
                          const config = getSessionTypeConfig(session.session_type);
                          return (
                            <button
                              key={folder.id}
                              onClick={() => window.open(folder.drive_folder_link, "_blank")}
                              className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 transition-colors text-left border border-amber-500/20"
                            >
                              <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{folder.client_name}</p>
                                <p className="text-[10px] text-muted-foreground">{session.start_time.slice(0, 5)}</p>
                              </div>
                              <Badge variant="outline" className={cn("text-[9px] shrink-0 px-1", config.color)}>
                                {config.label}
                              </Badge>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Other clients */}
                  {otherClients.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">
                        Tous les clients ({otherClients.length})
                      </p>
                      <div className="grid grid-cols-3 gap-1 max-h-[100px] overflow-y-auto">
                        {otherClients.slice(0, 12).map((folder) => (
                          <button
                            key={folder.id}
                            onClick={() => window.open(folder.drive_folder_link, "_blank")}
                            className="flex items-center gap-1.5 p-1.5 rounded hover:bg-muted/50 transition-colors text-left"
                          >
                            <FolderOpen className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="text-xs truncate">{folder.client_name}</span>
                          </button>
                        ))}
                      </div>
                      {otherClients.length > 12 && (
                        <p className="text-[10px] text-muted-foreground text-center mt-1">
                          +{otherClients.length - 12} autres...
                        </p>
                      )}
                    </div>
                  )}

                  {filteredDriveFolders.length === 0 && driveSearchTerm && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Aucun résultat pour "{driveSearchTerm}"
                    </p>
                  )}

                  {driveFolders.length === 0 && !driveSearchTerm && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Aucun dossier client enregistré
                    </p>
                  )}
                </div>
              )}

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