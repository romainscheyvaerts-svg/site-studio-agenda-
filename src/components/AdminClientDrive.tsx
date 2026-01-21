import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FolderOpen, Search, Calendar, Music, Mic2, Radio } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ClientDriveFolder {
  id: string;
  client_email: string;
  client_name: string;
  client_phone: string | null;
  drive_folder_id: string;
  drive_folder_link: string;
  created_at: string;
}

interface TodayBooking {
  id: string;
  client_email: string;
  client_name: string;
  session_type: string;
  start_time: string;
  end_time: string;
}

const SESSION_TYPE_ICONS: Record<string, { icon: typeof Mic2; label: string; color: string }> = {
  "with-engineer": { icon: Mic2, label: "Session", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  "with_engineer": { icon: Mic2, label: "Session", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  "without-engineer": { icon: Mic2, label: "Location", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  "without_engineer": { icon: Mic2, label: "Location", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  "mixing": { icon: Music, label: "Mixage", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  "mastering": { icon: Radio, label: "Mastering", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  "analog-mastering": { icon: Radio, label: "Mastering Analog", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  "analog_mastering": { icon: Radio, label: "Mastering Analog", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  "podcast": { icon: Mic2, label: "Podcast", color: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
};

const AdminClientDrive = () => {
  const { toast } = useToast();
  const [folders, setFolders] = useState<ClientDriveFolder[]>([]);
  const [todayBookings, setTodayBookings] = useState<TodayBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Récupérer tous les dossiers clients
      const { data: foldersData, error: foldersError } = await supabase
        .from("client_drive_folders")
        .select("*")
        .order("client_name");

      if (foldersError) throw foldersError;

      // Récupérer les réservations du jour
      const today = new Date().toISOString().split("T")[0];
      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select("id, client_email, client_name, session_type, start_time, end_time")
        .eq("session_date", today)
        .in("status", ["confirmed", "pending"]);

      if (bookingsError) throw bookingsError;

      setFolders(foldersData || []);
      setTodayBookings(bookingsData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Trouver les clients qui ont une session aujourd'hui
  const getTodaySessionForClient = (clientEmail: string): TodayBooking | undefined => {
    return todayBookings.find(
      (b) => b.client_email.toLowerCase() === clientEmail.toLowerCase()
    );
  };

  // Filtrer et trier les dossiers
  const filteredFolders = folders
    .filter((folder) => {
      const search = searchTerm.toLowerCase();
      return (
        folder.client_name.toLowerCase().includes(search) ||
        folder.client_email.toLowerCase().includes(search)
      );
    })
    .sort((a, b) => {
      // Mettre en premier ceux qui ont une session aujourd'hui
      const aHasSession = getTodaySessionForClient(a.client_email);
      const bHasSession = getTodaySessionForClient(b.client_email);

      if (aHasSession && !bHasSession) return -1;
      if (!aHasSession && bHasSession) return 1;

      // Ensuite trier par nom
      return a.client_name.localeCompare(b.client_name);
    });

  // Clients avec session aujourd'hui
  const clientsWithTodaySession = filteredFolders.filter((f) =>
    getTodaySessionForClient(f.client_email)
  );

  // Autres clients
  const otherClients = filteredFolders.filter(
    (f) => !getTodaySessionForClient(f.client_email)
  );

  const openDriveFolder = (link: string) => {
    window.open(link, "_blank");
  };

  const getSessionTypeInfo = (sessionType: string) => {
    const normalizedType = sessionType.replace(/_/g, "-");
    return SESSION_TYPE_ICONS[normalizedType] || SESSION_TYPE_ICONS[sessionType] || {
      icon: Calendar,
      label: sessionType,
      color: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barre de recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un client..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Sessions du jour - En avant */}
      {clientsWithTodaySession.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-400">
            <Calendar className="w-4 h-4" />
            Sessions aujourd'hui ({clientsWithTodaySession.length})
          </div>
          <div className="grid gap-2">
            {clientsWithTodaySession.map((folder) => {
              const todaySession = getTodaySessionForClient(folder.client_email)!;
              const typeInfo = getSessionTypeInfo(todaySession.session_type);
              const TypeIcon = typeInfo.icon;

              return (
                <Card
                  key={folder.id}
                  className="border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors cursor-pointer"
                  onClick={() => openDriveFolder(folder.drive_folder_link)}
                >
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-amber-500/20">
                        <FolderOpen className="w-5 h-5 text-amber-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{folder.client_name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {todaySession.start_time.slice(0, 5)} - {todaySession.end_time.slice(0, 5)}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className={`shrink-0 ${typeInfo.color}`}>
                      <TypeIcon className="w-3 h-3 mr-1" />
                      {typeInfo.label}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Tous les autres clients */}
      {otherClients.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <FolderOpen className="w-4 h-4" />
            Tous les clients ({otherClients.length})
          </div>
          <div className="grid gap-1 max-h-[300px] overflow-y-auto pr-1">
            {otherClients.map((folder) => (
              <Button
                key={folder.id}
                variant="ghost"
                className="w-full justify-start h-auto py-2 px-3 hover:bg-muted/50"
                onClick={() => openDriveFolder(folder.drive_folder_link)}
              >
                <FolderOpen className="w-4 h-4 mr-2 text-muted-foreground shrink-0" />
                <span className="truncate text-left">{folder.client_name}</span>
                <span className="ml-auto text-xs text-muted-foreground truncate max-w-[120px]">
                  {folder.client_email}
                </span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Message si aucun résultat */}
      {filteredFolders.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          {searchTerm ? (
            <p>Aucun client trouvé pour "{searchTerm}"</p>
          ) : (
            <p>Aucun dossier client enregistré</p>
          )}
        </div>
      )}

      {/* Info */}
      <p className="text-xs text-muted-foreground text-center pt-2">
        {folders.length} dossier(s) client(s) • {todayBookings.length} session(s) aujourd'hui
      </p>
    </div>
  );
};

export default AdminClientDrive;
