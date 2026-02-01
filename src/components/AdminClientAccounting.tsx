import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Clock,
  Calendar,
  User,
  Users,
  Loader2,
  Search,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from "lucide-react";

interface CalendarSession {
  id: string;
  title: string;
  date: string;
  startHour: number;
  endHour: number;
  duration: number;
}

interface ClientFromCalendar {
  email: string;
  name: string | null;
  totalSessions: number;
  totalHours: number;
  firstSession: string | null;
  lastSession: string | null;
  sessions: CalendarSession[];
}

const AdminClientAccounting = () => {
  const { t } = useTranslation();
  const [clients, setClients] = useState<ClientFromCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setProgress("Chargement des données...");
    
    try {
      // Use the existing get-weekly-availability function with a large date range
      // Fetch events for the last 2 years (730 days)
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 2);
      const startDateStr = startDate.toISOString().split("T")[0];
      
      setProgress("Récupération des événements du calendrier (2 dernières années)...");
      
      // Fetch in chunks of 90 days to avoid timeout
      const allSlots: Array<{ date: string; clientEmail?: string; eventName?: string; hour: number }> = [];
      let currentStart = new Date(startDate);
      const today = new Date();
      
      while (currentStart < today) {
        const chunkStartStr = currentStart.toISOString().split("T")[0];
        const daysToFetch = Math.min(90, Math.ceil((today.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24)));
        
        setProgress(`Chargement: ${chunkStartStr}...`);
        
        const { data, error: fetchError } = await supabase.functions.invoke("get-weekly-availability", {
          body: {
            startDate: chunkStartStr,
            days: daysToFetch,
            includeSuperadminCalendars: false
          }
        });

        if (fetchError) {
          console.error("Error fetching availability:", fetchError);
          // Continue with next chunk even if one fails
        } else if (data?.availability) {
          // Extract events with client emails
          for (const day of data.availability) {
            for (const slot of day.slots) {
              if (slot.status === "unavailable" && slot.clientEmail) {
                allSlots.push({
                  date: day.date,
                  clientEmail: slot.clientEmail,
                  eventName: slot.eventName,
                  hour: slot.hour
                });
              }
            }
          }
        }
        
        // Move to next chunk
        currentStart.setDate(currentStart.getDate() + daysToFetch);
      }

      setProgress("Analyse des données clients...");

      // Group events by client email and date to create sessions
      const clientsMap = new Map<string, ClientFromCalendar>();
      const sessionMap = new Map<string, CalendarSession>(); // key: email-date

      for (const slot of allSlots) {
        if (!slot.clientEmail) continue;

        const email = slot.clientEmail.toLowerCase();
        const sessionKey = `${email}-${slot.date}`;
        
        // Get or create session for this day
        let session = sessionMap.get(sessionKey);
        if (!session) {
          session = {
            id: sessionKey,
            title: slot.eventName || "Session",
            date: slot.date,
            startHour: slot.hour,
            endHour: slot.hour + 1,
            duration: 1
          };
          sessionMap.set(sessionKey, session);
        } else {
          // Extend session
          if (slot.hour < session.startHour) {
            session.startHour = slot.hour;
          }
          if (slot.hour + 1 > session.endHour) {
            session.endHour = slot.hour + 1;
          }
          session.duration = session.endHour - session.startHour;
          // Update title if we have a better one
          if (slot.eventName && !session.title.includes(slot.eventName)) {
            session.title = slot.eventName;
          }
        }

        // Get or create client
        let client = clientsMap.get(email);
        if (!client) {
          // Extract name from event title if possible
          let name: string | null = null;
          if (slot.eventName) {
            const cleanName = slot.eventName
              .replace(/session|réservation|booking|rec|recording|enregistrement|avec ingénieur|sans ingénieur|location|mixage|mastering/gi, "")
              .replace(/[-:]/g, " ")
              .trim();
            if (cleanName && !cleanName.includes("@") && cleanName.length > 2) {
              name = cleanName;
            }
          }
          
          client = {
            email,
            name,
            totalSessions: 0,
            totalHours: 0,
            firstSession: null,
            lastSession: null,
            sessions: []
          };
          clientsMap.set(email, client);
        }

        // Update first/last session
        if (!client.firstSession || slot.date < client.firstSession) {
          client.firstSession = slot.date;
        }
        if (!client.lastSession || slot.date > client.lastSession) {
          client.lastSession = slot.date;
        }
      }

      // Assign sessions to clients and calculate totals
      for (const [sessionKey, session] of sessionMap) {
        const email = sessionKey.split("-")[0];
        const client = clientsMap.get(email);
        if (client) {
          // Check if session already added (avoid duplicates)
          if (!client.sessions.find(s => s.id === session.id)) {
            client.sessions.push(session);
            client.totalHours += session.duration;
          }
        }
      }

      // Calculate total sessions (unique dates)
      for (const client of clientsMap.values()) {
        const uniqueDates = new Set(client.sessions.map(s => s.date));
        client.totalSessions = uniqueDates.size;
        // Sort sessions by date (newest first)
        client.sessions.sort((a, b) => b.date.localeCompare(a.date));
      }

      // Convert to array and sort by last session
      const clientsList = Array.from(clientsMap.values())
        .filter(c => c.totalSessions > 0)
        .sort((a, b) => (b.lastSession || "").localeCompare(a.lastSession || ""));

      setClients(clientsList);
      setProgress("");
    } catch (err) {
      console.error("Error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const toggleClientExpand = (email: string) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(email)) {
      newExpanded.delete(email);
    } else {
      newExpanded.add(email);
    }
    setExpandedClients(newExpanded);
  };

  const filteredClients = clients.filter(client => 
    client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.name?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  };

  const formatHours = (hours: number) => {
    return Math.round(hours * 10) / 10;
  };

  // Global stats
  const globalStats = {
    totalClients: clients.length,
    totalHours: clients.reduce((sum, c) => sum + c.totalHours, 0),
    totalSessions: clients.reduce((sum, c) => sum + c.totalSessions, 0),
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-muted-foreground text-center">{progress || "Chargement..."}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <p className="text-destructive mb-4">Erreur: {error}</p>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card border-primary/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-display text-foreground">{globalStats.totalClients}</p>
                <p className="text-xs text-muted-foreground">{t("admin.total_clients")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-accent/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-display text-foreground">{formatHours(globalStats.totalHours)}h</p>
                <p className="text-xs text-muted-foreground">{t("admin.total_hours_all")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-display text-foreground">{globalStats.totalSessions}</p>
                <p className="text-xs text-muted-foreground">Sessions totales</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Refresh */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t("admin.search_client")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
          Actualiser
        </Button>
      </div>

      {/* Info */}
      <div className="text-xs text-muted-foreground bg-secondary/30 p-3 rounded-lg">
        📅 Données extraites automatiquement de votre Google Calendar (2 dernières années). 
        Seuls les événements avec un email dans la description ou les participants sont listés.
      </div>

      {/* Client List */}
      <div className="space-y-3">
        {filteredClients.length === 0 ? (
          <Card className="bg-card">
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {searchTerm ? t("admin.no_clients_found") : "Aucun client avec email trouvé dans l'agenda"}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Pour qu'un client apparaisse, l'événement doit contenir son email (dans la description ou comme participant)
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredClients.map((client) => (
            <Card key={client.email} className="bg-card">
              <CardContent className="p-0">
                {/* Client Header */}
                <div
                  onClick={() => toggleClientExpand(client.email)}
                  className="p-4 cursor-pointer hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {client.name || client.email}
                        </p>
                        {client.name && (
                          <p className="text-xs text-muted-foreground">{client.email}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm text-muted-foreground">{t("account.total_hours")}</p>
                        <p className="font-display text-lg text-foreground">{formatHours(client.totalHours)}h</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">{t("account.total_sessions")}</p>
                        <p className="font-display text-lg text-foreground">{client.totalSessions}</p>
                      </div>
                      {expandedClients.has(client.email) ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Sessions */}
                {expandedClients.has(client.email) && (
                  <div className="border-t border-border p-4 bg-secondary/20">
                    <div className="space-y-3">
                      {client.sessions.map((session) => (
                        <div
                          key={session.id}
                          className="p-3 rounded-lg border border-border/50 bg-card flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Badge variant="outline" className="shrink-0">
                              {session.startHour}h-{session.endHour}h
                            </Badge>
                            <span className="text-sm text-foreground truncate">
                              {session.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-sm text-muted-foreground">
                              {formatDate(session.date)}
                            </span>
                            <span className="font-display text-lg text-foreground">
                              {formatHours(session.duration)}h
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Client Summary */}
                    <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/30">
                      <div className="flex items-center justify-between text-sm flex-wrap gap-2">
                        <span className="text-muted-foreground">
                          {t("admin.first_session")}: {client.firstSession && formatDate(client.firstSession)}
                        </span>
                        <span className="text-muted-foreground">
                          Dernière: {client.lastSession && formatDate(client.lastSession)}
                        </span>
                        <span className="font-display text-lg text-primary">
                          {formatHours(client.totalHours)}h au total
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminClientAccounting;