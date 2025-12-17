import { useState, useEffect } from "react";
import { Shield, Ban, RefreshCw, Globe, Activity, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ActivityLog {
  id: string;
  ip_address: string;
  country: string | null;
  action: string;
  user_email: string | null;
  path: string | null;
  created_at: string;
}

interface BlockedIP {
  id: string;
  ip_address: string;
  reason: string | null;
  blocked_by: string;
  blocked_at: string;
}

interface IPStats {
  ip_address: string;
  country: string | null;
  request_count: number;
  last_action: string;
  last_activity: string;
}

const AdminActivitySecurity = () => {
  const { toast } = useToast();
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>([]);
  const [ipStats, setIPStats] = useState<IPStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [blockingIP, setBlockingIP] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch recent activity logs
      const { data: logs, error: logsError } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (logsError) throw logsError;
      setActivityLogs((logs as ActivityLog[]) || []);

      // Calculate IP stats from logs
      const statsMap = new Map<string, IPStats>();
      ((logs as ActivityLog[]) || []).forEach((log) => {
        const existing = statsMap.get(log.ip_address);
        if (existing) {
          existing.request_count++;
          if (new Date(log.created_at) > new Date(existing.last_activity)) {
            existing.last_activity = log.created_at;
            existing.last_action = log.action;
          }
        } else {
          statsMap.set(log.ip_address, {
            ip_address: log.ip_address,
            country: log.country,
            request_count: 1,
            last_action: log.action,
            last_activity: log.created_at,
          });
        }
      });
      
      // Sort by request count descending
      const stats = Array.from(statsMap.values()).sort((a, b) => b.request_count - a.request_count);
      setIPStats(stats);

      // Fetch blocked IPs
      const { data: blocked, error: blockedError } = await supabase
        .from("blocked_ips")
        .select("*")
        .order("blocked_at", { ascending: false });

      if (blockedError) throw blockedError;
      setBlockedIPs((blocked as BlockedIP[]) || []);
    } catch (error: any) {
      console.error("Error fetching security data:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données de sécurité",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleBlockIP = async (ipAddress: string, reason?: string) => {
    setBlockingIP(ipAddress);
    try {
      const { error } = await supabase.from("blocked_ips").insert({
        ip_address: ipAddress,
        reason: reason || "Bloqué manuellement par admin",
        blocked_by: "admin",
      });

      if (error) {
        if (error.code === "23505") {
          toast({ title: "Info", description: "Cette IP est déjà bloquée." });
        } else {
          throw error;
        }
      } else {
        toast({ title: "Succès", description: `IP ${ipAddress} bloquée.` });
        fetchData();
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
    setBlockingIP(null);
  };

  const handleUnblockIP = async (id: string, ipAddress: string) => {
    try {
      const { error } = await supabase.from("blocked_ips").delete().eq("id", id);

      if (error) throw error;
      toast({ title: "Succès", description: `IP ${ipAddress} débloquée.` });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const isIPBlocked = (ipAddress: string): boolean => {
    return blockedIPs.some((b) => b.ip_address === ipAddress);
  };

  const filteredStats = ipStats.filter(
    (stat) =>
      stat.ip_address.includes(searchTerm) ||
      (stat.country && stat.country.toLowerCase().includes(searchTerm.toLowerCase())) ||
      stat.last_action.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("fr-BE", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Activité & Sécurité
        </h2>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-lg border border-border p-4 text-center">
          <Activity className="h-6 w-6 mx-auto mb-2 text-primary" />
          <div className="text-2xl font-bold text-foreground">{activityLogs.length}</div>
          <div className="text-xs text-muted-foreground">Actions récentes</div>
        </div>
        <div className="bg-card rounded-lg border border-border p-4 text-center">
          <Globe className="h-6 w-6 mx-auto mb-2 text-accent" />
          <div className="text-2xl font-bold text-foreground">{ipStats.length}</div>
          <div className="text-xs text-muted-foreground">IPs uniques</div>
        </div>
        <div className="bg-card rounded-lg border border-border p-4 text-center">
          <Ban className="h-6 w-6 mx-auto mb-2 text-destructive" />
          <div className="text-2xl font-bold text-foreground">{blockedIPs.length}</div>
          <div className="text-xs text-muted-foreground">IPs bloquées</div>
        </div>
      </div>

      {/* Blocked IPs Section */}
      {blockedIPs.length > 0 && (
        <div className="bg-destructive/10 rounded-xl border border-destructive/30 p-4">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Ban className="h-4 w-4 text-destructive" />
            IPs Bloquées ({blockedIPs.length})
          </h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {blockedIPs.map((blocked) => (
              <div
                key={blocked.id}
                className="flex items-center justify-between p-2 bg-background/50 rounded-lg text-sm"
              >
                <div>
                  <span className="font-mono text-foreground">{blocked.ip_address}</span>
                  {blocked.reason && (
                    <span className="text-muted-foreground ml-2">- {blocked.reason}</span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUnblockIP(blocked.id, blocked.ip_address)}
                  className="text-green-500 hover:text-green-400"
                >
                  Débloquer
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Log Table */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">Journal d'Activité par IP</h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher IP, pays, action..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">IP</th>
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Pays</th>
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Requêtes</th>
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Dernière Action</th>
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Date</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStats.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">
                    Aucune activité enregistrée
                  </td>
                </tr>
              ) : (
                filteredStats.map((stat) => {
                  const blocked = isIPBlocked(stat.ip_address);
                  return (
                    <tr
                      key={stat.ip_address}
                      className={cn(
                        "border-b border-border/50 hover:bg-muted/50",
                        blocked && "bg-destructive/10"
                      )}
                    >
                      <td className="py-3 px-3">
                        <span className="font-mono text-foreground">{stat.ip_address}</span>
                        {blocked && (
                          <span className="ml-2 text-xs text-destructive font-medium">BLOQUÉ</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">
                        {stat.country || "Inconnu"}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={cn(
                            "px-2 py-1 rounded text-xs font-medium",
                            stat.request_count > 50
                              ? "bg-destructive/20 text-destructive"
                              : stat.request_count > 20
                              ? "bg-amber-500/20 text-amber-500"
                              : "bg-green-500/20 text-green-500"
                          )}
                        >
                          {stat.request_count}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">{stat.last_action}</td>
                      <td className="py-3 px-3 text-muted-foreground">
                        {formatDate(stat.last_activity)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {!blocked ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleBlockIP(stat.ip_address)}
                            disabled={blockingIP === stat.ip_address}
                            className="text-destructive hover:text-destructive/80"
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const blockedEntry = blockedIPs.find(
                                (b) => b.ip_address === stat.ip_address
                              );
                              if (blockedEntry) {
                                handleUnblockIP(blockedEntry.id, stat.ip_address);
                              }
                            }}
                            className="text-green-500 hover:text-green-400"
                          >
                            Débloquer
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Note: Les logs sont limités aux 100 dernières entrées. Le blocage IP empêche l'accès au site.
      </p>
    </div>
  );
};

export default AdminActivitySecurity;