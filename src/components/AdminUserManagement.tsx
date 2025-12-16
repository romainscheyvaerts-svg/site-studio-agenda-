import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Users, Ban, Trash2, Search, Loader2, ChevronDown, ChevronUp, RefreshCw, AlertTriangle } from "lucide-react";
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

interface UserInfo {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  user_metadata: {
    full_name?: string;
    phone?: string;
  };
  isBlocked?: boolean;
}

interface BlockedUser {
  user_id: string;
  blocked_at: string;
  reason: string | null;
}

const AdminUserManagement = () => {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<UserInfo | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch blocked users list
      const { data: blocked, error: blockedError } = await supabase
        .from("blocked_users")
        .select("user_id, blocked_at, reason");
      
      if (blockedError) throw blockedError;
      setBlockedUsers(blocked || []);

      // Note: We can't list all users from client-side without admin API
      // We'll show blocked users and search functionality
      toast({
        title: "Liste chargée",
        description: `${blocked?.length || 0} utilisateur(s) bloqué(s)`,
      });
    } catch (err) {
      console.error("Error fetching users:", err);
      toast({
        title: "Erreur",
        description: "Impossible de charger la liste",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded) {
      fetchUsers();
    }
  }, [expanded]);

  const handleBlockUser = async (userId: string, email: string) => {
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
        description: `${email} a été bloqué`,
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

  const handleDeleteUser = async (user: UserInfo) => {
    setActionLoading(user.id);
    try {
      // Note: Deleting users requires admin API access via edge function
      // For now, we just block them permanently
      const { error } = await supabase
        .from("blocked_users")
        .upsert({
          user_id: user.id,
          blocked_by: "admin",
          reason: "Compte supprimé par administrateur"
        });
      
      if (error) throw error;
      
      toast({
        title: "Compte désactivé",
        description: `Le compte de ${user.email} a été désactivé définitivement`,
      });
      
      setBlockedUsers([...blockedUsers.filter(b => b.user_id !== user.id), { 
        user_id: user.id, 
        blocked_at: new Date().toISOString(), 
        reason: "Compte supprimé" 
      }]);
    } catch (err) {
      console.error("Error deleting user:", err);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'utilisateur",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
      setDeleteConfirm(null);
    }
  };

  const isBlocked = (userId: string) => blockedUsers.some(b => b.user_id === userId);

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
            {blockedUsers.length} bloqué(s)
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
                placeholder="Rechercher par email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="icon" onClick={fetchUsers} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </Button>
          </div>

          {/* Blocked users list */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-destructive flex items-center gap-2">
              <Ban className="w-4 h-4" />
              Utilisateurs bloqués ({blockedUsers.length})
            </h4>
            
            {blockedUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3 bg-secondary/50 rounded-lg">
                Aucun utilisateur bloqué
              </p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {blockedUsers
                  .filter(b => !searchTerm || b.user_id.includes(searchTerm))
                  .map((blocked) => (
                    <div
                      key={blocked.user_id}
                      className="flex items-center justify-between p-3 bg-destructive/10 border border-destructive/30 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-mono text-foreground">{blocked.user_id.slice(0, 8)}...</p>
                        <p className="text-xs text-muted-foreground">
                          Bloqué le {new Date(blocked.blocked_at).toLocaleDateString("fr-FR")}
                        </p>
                        {blocked.reason && (
                          <p className="text-xs text-destructive">{blocked.reason}</p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnblockUser(blocked.user_id)}
                        disabled={actionLoading === blocked.user_id}
                      >
                        {actionLoading === blocked.user_id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Débloquer"
                        )}
                      </Button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <p className="text-xs text-amber-500 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Pour bloquer un utilisateur spécifique, utilisez son ID (visible dans les logs de réservation).
            </p>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce compte ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le compte de {deleteConfirm?.email} sera définitivement désactivé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDeleteUser(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUserManagement;
