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
  Euro,
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase.functions.invoke("get-client-stats-from-calendar");

      if (fetchError) {
        console.error("Error fetching client stats:", fetchError);
        setError(fetchError.message);
        return;
      }

      if (data?.error) {
        console.error("Function error:", data.error);
        setError(data.error);
        return;
      }

      setClients(data?.clients || []);
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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Chargement des données depuis l'agenda...</span>
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
        Les emails sont détectés depuis les participants ou la description des événements.
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
                Assurez-vous que vos événements contiennent l'email du client (dans les participants ou la description)
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
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {t("admin.first_session")}: {client.firstSession && formatDate(client.firstSession)}
                        </span>
                        <span className="text-muted-foreground">
                          Dernière session: {client.lastSession && formatDate(client.lastSession)}
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