import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Users, Ban, Search, Loader2, ChevronDown, ChevronUp, RefreshCw, AlertTriangle, Globe, Mail, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RegisteredUser {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  phone: string | null;
  user_metadata?: {
    full_name?: string;
    phone?: string;
  };
}

interface UserActivity {
  user_id: string | null;
  user_email: string | null;
  ip_address: string;
  country: string | null;
  last_action: string;
  action_count: number;
}

interface BlockedUser {
  user_id: string;
  blocked_at: string;
  reason: string | null;
}

interface BlockedIP {
  ip_address: string;
  blocked_at: string;
  reason: string | null;
}

// Simple IP geolocation using free API
async function getCountryFromIP(ip: string): Promise<string | null> {
  try {
    if (ip === "unknown" || ip.startsWith("192.168.") || ip.startsWith("10.") || ip === "127.0.0.1") {
      return "Local";
    }
    const response = await fetch(`https://ipapi.co/${ip}/country_name/`);
    if (response.ok) {
      const country = await response.text();
      return country && country !== "Undefined" ? country : null;
    }
  } catch (err) {
    console.error("IP lookup error:", err);
  }
  return null;
}

const AdminUserManagement = () => {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [userActivities, setUserActivities] = useState<UserActivity[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [blockConfirm, setBlockConfirm] = useState<{ type: "user" | "ip"; id: string; email?: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"registered" | "activity">("registered");

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get session for auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error("No session available");
        toast({
          title: "Erreur",
          description: "Non authentifié",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Fetch registered users from edge function using fetch for better header control
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/list-users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      const usersData = await response.json();

      if (response.ok && usersData?.users) {
        setRegisteredUsers(usersData.users);
      } else {
        console.error("Error fetching users:", usersData?.error);
      }

      // Fetch blocked users
      const { data: blocked, error: blockedError } = await supabase
        .from("blocked_users")
        .select("user_id, blocked_at, reason");
      
      if (!blockedError && blocked) {
        setBlockedUsers(blocked);
      }

      // Fetch blocked IPs
      const { data: blockedIPsData, error: blockedIPsError } = await supabase
        .from("blocked_ips")
        .select("ip_address, blocked_at, reason");
      
      if (!blockedIPsError && blockedIPsData) {
        setBlockedIPs(blockedIPsData);
      }

      // Fetch user activities from activity_logs (aggregated by user)
      const { data: activities, error: activitiesError } = await supabase
        .from("activity_logs")
        .select("user_id, user_email, ip_address, country, action, created_at")
        .order("created_at", { ascending: false })
        .limit(500);

      if (!activitiesError && activities) {
        // Aggregate by user email or IP
        const userMap = new Map<string, UserActivity>();
        
        for (const activity of activities) {
          const key = activity.user_email || activity.ip_address;
          if (!userMap.has(key)) {
            userMap.set(key, {
              user_id: activity.user_id,
              user_email: activity.user_email,
              ip_address: activity.ip_address,
              country: activity.country,
              last_action: activity.created_at,
              action_count: 1,
            });
          } else {
            const existing = userMap.get(key)!;
            existing.action_count++;
            if (new Date(activity.created_at) > new Date(existing.last_action)) {
              existing.last_action = activity.created_at;
              existing.ip_address = activity.ip_address;
              existing.country = activity.country;
            }
          }
        }

        // Fetch countries for IPs that don't have them
        const activitiesArray = Array.from(userMap.values());
        const needsCountry = activitiesArray.filter(a => !a.country && a.ip_address !== "unknown");
        
        if (needsCountry.length <= 10) {
          for (const activity of needsCountry) {
            const country = await getCountryFromIP(activity.ip_address);
            if (country) {
              activity.country = country;
            }
          }
        }

        // Filter out admin emails
        const adminEmails = ["prod.makemusic@gmail.com", "kazamzamka@gmail.com", "romain.scheyvaerts@gmail.com"];
        const filteredActivities = activitiesArray.filter(
          a => !a.user_email || !adminEmails.includes(a.user_email)
        );

        setUserActivities(filteredActivities);
      }

      toast({
        title: "Données chargées",
        description: `${blocked?.length || 0} utilisateur(s) bloqué(s), ${blockedIPsData?.length || 0} IP bloquée(s)`,
      });
    } catch (err) {
      console.error("Error fetching data:", err);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded) {
      fetchData();
    }
  }, [expanded]);

  const handleBlockUser = async (userId: string) => {
    setActionLoading(userId);
    try {
      const { error } = await supabase
        .from("blocked_users")
        .insert({
          user_id: userId,
          blocked_by: "admin",
          reason: "Bloqué par administrateur"
        });
      
      if (error) throw error;
      
      setBlockedUsers([...blockedUsers, { user_id: userId, blocked_at: new Date().toISOString(), reason: null }]);
      toast({
        title: "Utilisateur bloqué",
        description: "L'utilisateur ne pourra plus se connecter",
      });
    } catch (err) {
      console.error("Error blocking user:", err);
      toast({
        title: "Erreur",
        description: "Impossible de bloquer l'utilisateur",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
      setBlockConfirm(null);
    }
  };

  const handleUnblockUser = async (userId: string) => {
    setActionLoading(userId);
    try {
      const { error } = await supabase
        .from("blocked_users")
        .delete()
        .eq("user_id", userId);
      
      if (error) throw error;
      
      setBlockedUsers(blockedUsers.filter(b => b.user_id !== userId));
      toast({
        title: "Utilisateur débloqué",
        description: "L'utilisateur peut à nouveau se connecter",
      });
    } catch (err) {
      console.error("Error unblocking user:", err);
      toast({
        title: "Erreur",
        description: "Impossible de débloquer l'utilisateur",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleBlockIP = async (ip: string) => {
    setActionLoading(ip);
    try {
      const { error } = await supabase
        .from("blocked_ips")
        .insert({
          ip_address: ip,
          blocked_by: "admin",
          reason: "Bloqué par administrateur"
        });
      
      if (error) throw error;
      
      setBlockedIPs([...blockedIPs, { ip_address: ip, blocked_at: new Date().toISOString(), reason: null }]);
      toast({
        title: "IP bloquée",
        description: `L'adresse ${ip} est maintenant bloquée`,
      });
    } catch (err) {
      console.error("Error blocking IP:", err);
      toast({
        title: "Erreur",
        description: "Impossible de bloquer l'IP",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
      setBlockConfirm(null);
    }
  };

  const handleUnblockIP = async (ip: string) => {
    setActionLoading(ip);
    try {
      const { error } = await supabase
        .from("blocked_ips")
        .delete()
        .eq("ip_address", ip);
      
      if (error) throw error;
      
      setBlockedIPs(blockedIPs.filter(b => b.ip_address !== ip));
      toast({
        title: "IP débloquée",
        description: `L'adresse ${ip} est maintenant débloquée`,
      });
    } catch (err) {
      console.error("Error unblocking IP:", err);
      toast({
        title: "Erreur",
        description: "Impossible de débloquer l'IP",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const isUserBlocked = (userId: string | null) => userId ? blockedUsers.some(b => b.user_id === userId) : false;
  const isIPBlocked = (ip: string) => blockedIPs.some(b => b.ip_address === ip);

  const filteredActivities = userActivities.filter(activity => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      activity.user_email?.toLowerCase().includes(search) ||
      activity.ip_address.toLowerCase().includes(search) ||
      activity.country?.toLowerCase().includes(search)
    );
  });

  const filteredRegisteredUsers = registeredUsers.filter(user => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      user.email?.toLowerCase().includes(search) ||
      user.user_metadata?.full_name?.toLowerCase().includes(search) ||
      user.phone?.toLowerCase().includes(search)
    );
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between bg-card hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-primary" />
          <span className="font-display text-lg text-foreground">GESTION UTILISATEURS</span>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">
            {registeredUsers.length} inscrit(s) • {blockedUsers.length} bloqué(s)
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>
      
      {expanded && (
        <div className="p-4 border-t border-border space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par email, nom, IP ou pays..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-border pb-2">
            <button
              onClick={() => setActiveTab("registered")}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-t-lg transition-colors",
                activeTab === "registered"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              Comptes inscrits ({filteredRegisteredUsers.length})
            </button>
            <button
              onClick={() => setActiveTab("activity")}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-t-lg transition-colors",
                activeTab === "activity"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              Activité récente ({filteredActivities.length})
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
              <span className="text-muted-foreground">Chargement...</span>
            </div>
          ) : (
            <>
              {/* Registered Users List */}
              {activeTab === "registered" && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    Comptes inscrits ({filteredRegisteredUsers.length})
                  </h4>
                  
                  {filteredRegisteredUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-3 bg-secondary/50 rounded-lg">
                      Aucun compte trouvé
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {filteredRegisteredUsers.map((user) => {
                        const userBlocked = isUserBlocked(user.id);
                        
                        return (
                          <div
                            key={user.id}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-lg border",
                              userBlocked
                                ? "bg-destructive/10 border-destructive/30"
                                : "bg-secondary/50 border-border"
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-foreground flex items-center gap-1">
                                  <Mail className="w-3 h-3 text-primary" />
                                  {user.email || "Email inconnu"}
                                </span>
                                {user.user_metadata?.full_name && (
                                  <span className="text-xs text-muted-foreground">
                                    ({user.user_metadata.full_name})
                                  </span>
                                )}
                                {userBlocked && (
                                  <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded">
                                    BLOQUÉ
                                  </span>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Inscrit le {formatDate(user.created_at)}
                                </span>
                                {user.last_sign_in_at && (
                                  <span className="text-primary">
                                    Dernière connexion: {formatDate(user.last_sign_in_at)}
                                  </span>
                                )}
                                {user.phone && (
                                  <span>📞 {user.phone}</span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 ml-2">
                              {!userBlocked ? (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => setBlockConfirm({ 
                                    type: "user", 
                                    id: user.id, 
                                    email: user.email || undefined 
                                  })}
                                  disabled={actionLoading === user.id}
                                  className="text-xs"
                                >
                                  {actionLoading === user.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <>
                                      <Ban className="w-3 h-3 mr-1" />
                                      Bloquer
                                    </>
                                  )}
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUnblockUser(user.id)}
                                  disabled={actionLoading === user.id}
                                  className="text-xs"
                                >
                                  {actionLoading === user.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    "Débloquer"
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* User Activities List */}
              {activeTab === "activity" && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Activité récente ({filteredActivities.length})
                </h4>
                
                {filteredActivities.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3 bg-secondary/50 rounded-lg">
                    Aucun utilisateur trouvé
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {filteredActivities.map((activity, index) => {
                      const key = activity.user_email || activity.ip_address || index;
                      const userBlocked = isUserBlocked(activity.user_id);
                      const ipBlocked = isIPBlocked(activity.ip_address);
                      
                      return (
                        <div
                          key={key}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border",
                            userBlocked || ipBlocked
                              ? "bg-destructive/10 border-destructive/30"
                              : "bg-secondary/50 border-border"
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {activity.user_email ? (
                                <span className="text-sm font-medium text-foreground flex items-center gap-1">
                                  <Mail className="w-3 h-3 text-primary" />
                                  {activity.user_email}
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground italic">Visiteur anonyme</span>
                              )}
                              {userBlocked && (
                                <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded">
                                  BLOQUÉ
                                </span>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1 font-mono">
                                IP: {activity.ip_address}
                                {ipBlocked && (
                                  <span className="text-destructive">(bloquée)</span>
                                )}
                              </span>
                              {activity.country && (
                                <span className="flex items-center gap-1">
                                  <Globe className="w-3 h-3" />
                                  {activity.country}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(activity.last_action)}
                              </span>
                              <span className="text-primary">
                                {activity.action_count} action(s)
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 ml-2">
                            {/* Block/Unblock IP */}
                            {!ipBlocked ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setBlockConfirm({ type: "ip", id: activity.ip_address })}
                                disabled={actionLoading === activity.ip_address}
                                className="text-xs"
                              >
                                {actionLoading === activity.ip_address ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <>
                                    <Ban className="w-3 h-3 mr-1" />
                                    Bloquer IP
                                  </>
                                )}
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUnblockIP(activity.ip_address)}
                                disabled={actionLoading === activity.ip_address}
                                className="text-xs"
                              >
                                {actionLoading === activity.ip_address ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  "Débloquer IP"
                                )}
                              </Button>
                            )}
                            
                            {/* Block/Unblock User (only if user_id exists) */}
                            {activity.user_id && (
                              !userBlocked ? (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => setBlockConfirm({ 
                                    type: "user", 
                                    id: activity.user_id!, 
                                    email: activity.user_email || undefined 
                                  })}
                                  disabled={actionLoading === activity.user_id}
                                  className="text-xs"
                                >
                                  {actionLoading === activity.user_id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <>
                                      <Ban className="w-3 h-3 mr-1" />
                                      Bloquer
                                    </>
                                  )}
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUnblockUser(activity.user_id!)}
                                  disabled={actionLoading === activity.user_id}
                                  className="text-xs"
                                >
                                  {actionLoading === activity.user_id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    "Débloquer"
                                  )}
                                </Button>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              )}

              {/* Blocked users summary */}
              {blockedUsers.length > 0 && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                  <h4 className="text-sm font-semibold text-destructive flex items-center gap-2 mb-2">
                    <Ban className="w-4 h-4" />
                    Utilisateurs bloqués ({blockedUsers.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {blockedUsers.map((blocked) => (
                      <div key={blocked.user_id} className="flex items-center gap-2 bg-destructive/20 px-2 py-1 rounded text-xs">
                        <span className="font-mono">{blocked.user_id.slice(0, 8)}...</span>
                        <button
                          onClick={() => handleUnblockUser(blocked.user_id)}
                          className="text-destructive hover:text-destructive/80"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-xs text-amber-500 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Les pays sont détectés automatiquement via les adresses IP. Les utilisateurs bloqués ne peuvent plus se connecter.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Block confirmation dialog */}
      <AlertDialog open={!!blockConfirm} onOpenChange={() => setBlockConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {blockConfirm?.type === "user" ? "Bloquer cet utilisateur ?" : "Bloquer cette IP ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {blockConfirm?.type === "user" 
                ? `L'utilisateur ${blockConfirm.email || blockConfirm.id} ne pourra plus se connecter.`
                : `L'adresse IP ${blockConfirm?.id} sera bloquée.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (blockConfirm?.type === "user") {
                  handleBlockUser(blockConfirm.id);
                } else if (blockConfirm?.type === "ip") {
                  handleBlockIP(blockConfirm.id);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Bloquer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUserManagement;
