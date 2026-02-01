import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  RefreshCw,
  TrendingUp,
  BarChart3,
  Gift
} from "lucide-react";

interface CalendarSession {
  id: string;
  title: string;
  date: string;
  startHour: number;
  endHour: number;
  duration: number;
  isFree: boolean;
}

interface ClientFromCalendar {
  email: string;
  name: string | null;
  totalSessions: number;
  totalHours: number;
  totalPaidHours: number;
  totalFreeHours: number;
  firstSession: string | null;
  lastSession: string | null;
  sessions: CalendarSession[];
}

interface MonthlyStats {
  month: string; // YYYY-MM
  label: string;
  totalHours: number;
  paidHours: number;
  freeHours: number;
  sessions: number;
}

interface YearlyStats {
  year: string;
  totalHours: number;
  paidHours: number;
  freeHours: number;
  sessions: number;
}

const AdminClientAccounting = () => {
  const { t } = useTranslation();
  const [clients, setClients] = useState<ClientFromCalendar[]>([]);
  const [allSessions, setAllSessions] = useState<CalendarSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");
  
  // Filters
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("clients");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setProgress("Chargement des données...");
    
    try {
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 2);
      
      setProgress("Récupération des événements du calendrier (2 dernières années)...");
      
      const allSlots: Array<{ 
        date: string; 
        clientEmail?: string; 
        eventName?: string; 
        hour: number;
        isFree?: boolean;
      }> = [];
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
        } else if (data?.availability) {
          for (const day of data.availability) {
            for (const slot of day.slots) {
              if (slot.status === "unavailable" && slot.eventName) {
                // Detect if session is free (has [FREE] tag in name)
                const isFree = slot.eventName?.toLowerCase().includes("[free]") || false;
                
                allSlots.push({
                  date: day.date,
                  clientEmail: slot.clientEmail,
                  eventName: slot.eventName,
                  hour: slot.hour,
                  isFree
                });
              }
            }
          }
        }
        
        currentStart.setDate(currentStart.getDate() + daysToFetch);
      }

      setProgress("Analyse des données clients...");

      const clientsMap = new Map<string, ClientFromCalendar>();
      const sessionMap = new Map<string, CalendarSession>();
      const sessionsForStats: CalendarSession[] = [];

      for (const slot of allSlots) {
        const sessionKey = slot.clientEmail 
          ? `${slot.clientEmail.toLowerCase()}-${slot.date}`
          : `unknown-${slot.date}-${slot.eventName}`;
        
        let session = sessionMap.get(sessionKey);
        if (!session) {
          session = {
            id: sessionKey,
            title: slot.eventName || "Session",
            date: slot.date,
            startHour: slot.hour,
            endHour: slot.hour + 1,
            duration: 1,
            isFree: slot.isFree || false
          };
          sessionMap.set(sessionKey, session);
        } else {
          if (slot.hour < session.startHour) {
            session.startHour = slot.hour;
          }
          if (slot.hour + 1 > session.endHour) {
            session.endHour = slot.hour + 1;
          }
          session.duration = session.endHour - session.startHour;
          if (slot.eventName && !session.title.includes(slot.eventName)) {
            session.title = slot.eventName;
          }
          // Update isFree if any slot has the tag
          if (slot.isFree) {
            session.isFree = true;
          }
        }

        if (slot.clientEmail) {
          const email = slot.clientEmail.toLowerCase();
          
          let client = clientsMap.get(email);
          if (!client) {
            let name: string | null = null;
            if (slot.eventName) {
              const cleanName = slot.eventName
                .replace(/\[FREE\]/gi, "")
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
              totalPaidHours: 0,
              totalFreeHours: 0,
              firstSession: null,
              lastSession: null,
              sessions: []
            };
            clientsMap.set(email, client);
          }

          if (!client.firstSession || slot.date < client.firstSession) {
            client.firstSession = slot.date;
          }
          if (!client.lastSession || slot.date > client.lastSession) {
            client.lastSession = slot.date;
          }
        }
      }

      // Assign sessions to clients and calculate totals
      for (const [sessionKey, session] of sessionMap) {
        sessionsForStats.push(session);
        
        const emailPart = sessionKey.split("-")[0];
        if (emailPart !== "unknown") {
          const client = clientsMap.get(emailPart);
          if (client) {
            if (!client.sessions.find(s => s.id === session.id)) {
              client.sessions.push(session);
              client.totalHours += session.duration;
              if (session.isFree) {
                client.totalFreeHours += session.duration;
              } else {
                client.totalPaidHours += session.duration;
              }
            }
          }
        }
      }

      for (const client of clientsMap.values()) {
        const uniqueDates = new Set(client.sessions.map(s => s.date));
        client.totalSessions = uniqueDates.size;
        client.sessions.sort((a, b) => b.date.localeCompare(a.date));
      }

      const clientsList = Array.from(clientsMap.values())
        .filter(c => c.totalSessions > 0)
        .sort((a, b) => (b.lastSession || "").localeCompare(a.lastSession || ""));

      setClients(clientsList);
      setAllSessions(sessionsForStats);
      setProgress("");
    } catch (err) {
      console.error("Error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  // Calculate monthly and yearly stats
  const { monthlyStats, yearlyStats, availableYears, availableMonths } = useMemo(() => {
    const monthlyMap = new Map<string, MonthlyStats>();
    const yearlyMap = new Map<string, YearlyStats>();
    const yearsSet = new Set<string>();
    const monthsSet = new Set<string>();

    for (const session of allSessions) {
      const year = session.date.substring(0, 4);
      const month = session.date.substring(0, 7);
      
      yearsSet.add(year);
      monthsSet.add(month);

      // Monthly stats
      if (!monthlyMap.has(month)) {
        const monthDate = new Date(month + "-01");
        const monthLabel = monthDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
        monthlyMap.set(month, {
          month,
          label: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
          totalHours: 0,
          paidHours: 0,
          freeHours: 0,
          sessions: 0
        });
      }
      const monthStats = monthlyMap.get(month)!;
      monthStats.totalHours += session.duration;
      monthStats.sessions++;
      if (session.isFree) {
        monthStats.freeHours += session.duration;
      } else {
        monthStats.paidHours += session.duration;
      }

      // Yearly stats
      if (!yearlyMap.has(year)) {
        yearlyMap.set(year, {
          year,
          totalHours: 0,
          paidHours: 0,
          freeHours: 0,
          sessions: 0
        });
      }
      const yearStats = yearlyMap.get(year)!;
      yearStats.totalHours += session.duration;
      yearStats.sessions++;
      if (session.isFree) {
        yearStats.freeHours += session.duration;
      } else {
        yearStats.paidHours += session.duration;
      }
    }

    return {
      monthlyStats: Array.from(monthlyMap.values()).sort((a, b) => b.month.localeCompare(a.month)),
      yearlyStats: Array.from(yearlyMap.values()).sort((a, b) => b.year.localeCompare(a.year)),
      availableYears: Array.from(yearsSet).sort((a, b) => b.localeCompare(a)),
      availableMonths: Array.from(monthsSet).sort((a, b) => b.localeCompare(a))
    };
  }, [allSessions]);

  // Filter clients by selected period
  const filteredClients = useMemo(() => {
    let filtered = clients;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(client => 
        client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (client.name?.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Filter by year and month
    if (selectedYear !== "all" || selectedMonth !== "all") {
      filtered = filtered.map(client => {
        const filteredSessions = client.sessions.filter(s => {
          const sessionYear = s.date.substring(0, 4);
          const sessionMonth = s.date.substring(0, 7);
          
          if (selectedYear !== "all" && sessionYear !== selectedYear) return false;
          if (selectedMonth !== "all" && sessionMonth !== selectedMonth) return false;
          return true;
        });

        const totalHours = filteredSessions.reduce((sum, s) => sum + s.duration, 0);
        const paidHours = filteredSessions.filter(s => !s.isFree).reduce((sum, s) => sum + s.duration, 0);
        const freeHours = filteredSessions.filter(s => s.isFree).reduce((sum, s) => sum + s.duration, 0);

        return {
          ...client,
          sessions: filteredSessions,
          totalSessions: new Set(filteredSessions.map(s => s.date)).size,
          totalHours,
          totalPaidHours: paidHours,
          totalFreeHours: freeHours
        };
      }).filter(c => c.totalSessions > 0);
    }

    return filtered;
  }, [clients, searchTerm, selectedYear, selectedMonth]);

  // Global stats based on filters
  const globalStats = useMemo(() => {
    const stats = {
      totalClients: filteredClients.length,
      totalHours: filteredClients.reduce((sum, c) => sum + c.totalHours, 0),
      totalPaidHours: filteredClients.reduce((sum, c) => sum + c.totalPaidHours, 0),
      totalFreeHours: filteredClients.reduce((sum, c) => sum + c.totalFreeHours, 0),
      totalSessions: filteredClients.reduce((sum, c) => sum + c.totalSessions, 0),
    };
    return stats;
  }, [filteredClients]);

  const toggleClientExpand = (email: string) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(email)) {
      newExpanded.delete(email);
    } else {
      newExpanded.add(email);
    }
    setExpandedClients(newExpanded);
  };

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
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="clients" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Par Client
          </TabsTrigger>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Comptabilité Générale
          </TabsTrigger>
        </TabsList>

        {/* Client Tab */}
        <TabsContent value="clients" className="space-y-6">
          {/* Global Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-card border-primary/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-display text-foreground">{globalStats.totalClients}</p>
                    <p className="text-xs text-muted-foreground">Clients</p>
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
                    <p className="text-xs text-muted-foreground">Heures totales</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-green-500/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-display text-foreground">{formatHours(globalStats.totalPaidHours)}h</p>
                    <p className="text-xs text-muted-foreground">Heures payantes</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-purple-500/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Gift className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-display text-foreground">{formatHours(globalStats.totalFreeHours)}h</p>
                    <p className="text-xs text-muted-foreground">Heures offertes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Année" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Mois" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les mois</SelectItem>
                  {availableMonths.map(month => {
                    const monthDate = new Date(month + "-01");
                    const label = monthDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
                    return (
                      <SelectItem key={month} value={month}>
                        {label.charAt(0).toUpperCase() + label.slice(1)}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              
              <Button variant="outline" onClick={fetchData} disabled={loading}>
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              </Button>
            </div>
          </div>

          {/* Client List */}
          <div className="space-y-3">
            {filteredClients.length === 0 ? (
              <Card className="bg-card">
                <CardContent className="py-12 text-center">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Aucun client trouvé</p>
                </CardContent>
              </Card>
            ) : (
              filteredClients.map((client) => (
                <Card key={client.email} className="bg-card">
                  <CardContent className="p-0">
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

                        <div className="flex items-center gap-4">
                          <div className="text-right hidden sm:block">
                            <p className="font-display text-lg text-foreground">{formatHours(client.totalHours)}h</p>
                            <p className="text-xs text-muted-foreground">
                              {formatHours(client.totalPaidHours)}h payées
                              {client.totalFreeHours > 0 && (
                                <span className="text-purple-400"> + {formatHours(client.totalFreeHours)}h offertes</span>
                              )}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-display text-lg text-foreground">{client.totalSessions}</p>
                            <p className="text-xs text-muted-foreground">sessions</p>
                          </div>
                          {expandedClients.has(client.email) ? (
                            <ChevronUp className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>

                    {expandedClients.has(client.email) && (
                      <div className="border-t border-border p-4 bg-secondary/20">
                        <div className="space-y-3">
                          {client.sessions.map((session) => (
                            <div
                              key={session.id}
                              className={cn(
                                "p-3 rounded-lg border bg-card flex items-center justify-between gap-4",
                                session.isFree ? "border-purple-500/30" : "border-border/50"
                              )}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <Badge variant="outline" className="shrink-0">
                                  {session.startHour}h-{session.endHour}h
                                </Badge>
                                {session.isFree && (
                                  <Badge variant="outline" className="shrink-0 bg-purple-500/20 text-purple-400 border-purple-500/30">
                                    <Gift className="w-3 h-3 mr-1" />
                                    Gratuit
                                  </Badge>
                                )}
                                <span className="text-sm text-foreground truncate">
                                  {session.title.replace(/\[FREE\]/gi, "").trim()}
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

                        <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/30">
                          <div className="flex items-center justify-between text-sm flex-wrap gap-2">
                            <span className="text-muted-foreground">
                              1ère session: {client.firstSession && formatDate(client.firstSession)}
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
        </TabsContent>

        {/* General Accounting Tab */}
        <TabsContent value="general" className="space-y-6">
          {/* Yearly Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Statistiques par Année
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {yearlyStats.map(stat => (
                  <div key={stat.year} className="p-4 rounded-lg border border-border bg-secondary/20">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xl font-display text-foreground">{stat.year}</h4>
                      <Badge variant="outline" className="text-lg px-3 py-1">
                        {stat.sessions} sessions
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total</p>
                        <p className="text-2xl font-display text-foreground">{formatHours(stat.totalHours)}h</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Payantes</p>
                        <p className="text-2xl font-display text-green-500">{formatHours(stat.paidHours)}h</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Offertes</p>
                        <p className="text-2xl font-display text-purple-500">{formatHours(stat.freeHours)}h</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Monthly Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Statistiques par Mois
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {monthlyStats.map(stat => (
                  <div key={stat.month} className="p-3 rounded-lg border border-border/50 bg-card flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-foreground min-w-[150px]">{stat.label}</span>
                      <Badge variant="outline">{stat.sessions} sessions</Badge>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <span className="text-sm text-muted-foreground">Total: </span>
                        <span className="font-display text-foreground">{formatHours(stat.totalHours)}h</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm text-green-500">{formatHours(stat.paidHours)}h</span>
                        <span className="text-sm text-muted-foreground"> / </span>
                        <span className="text-sm text-purple-500">{formatHours(stat.freeHours)}h</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminClientAccounting;
