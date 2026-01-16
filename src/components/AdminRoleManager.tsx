import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Shield, RefreshCw, Search, Crown } from "lucide-react";
import { toast } from "sonner";

interface UserWithRole {
  id: string;
  email: string;
  isAdmin: boolean;
  created_at: string;
}

const SUPER_ADMIN_EMAILS = ["prod.makemusic@gmail.com", "romain.scheyvaerts@gmail.com"];

const AdminRoleManager = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingUsers, setUpdatingUsers] = useState<Set<string>>(new Set());
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    checkSuperAdminStatus();
  }, []);

  const checkSuperAdminStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email && SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase())) {
      setIsSuperAdmin(true);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Non authentifié");
        return;
      }

      // Get all users via edge function using fetch directly
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/list-users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      const usersData = await response.json();

      if (!response.ok) {
        throw new Error(usersData?.error || "Erreur lors du chargement");
      }

      // Get all admin roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("role", "admin");

      if (rolesError) throw rolesError;

      const adminUserIds = new Set(rolesData?.map(r => r.user_id) || []);

      // Combine users with their admin status
      const usersWithRoles: UserWithRole[] = (usersData?.users || []).map((u: any) => ({
        id: u.id,
        email: u.email,
        isAdmin: adminUserIds.has(u.id),
        created_at: u.created_at,
      }));

      // Sort: admins first, then by email
      usersWithRoles.sort((a, b) => {
        if (a.isAdmin && !b.isAdmin) return -1;
        if (!a.isAdmin && b.isAdmin) return 1;
        return a.email.localeCompare(b.email);
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Erreur lors du chargement des utilisateurs");
    } finally {
      setLoading(false);
    }
  };

  const toggleAdminRole = async (userId: string, currentIsAdmin: boolean) => {
    setUpdatingUsers(prev => new Set(prev).add(userId));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Non authentifié");
        return;
      }

      // Use fetch directly for better header control
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/manage-admin-role`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          targetUserId: userId,
          action: currentIsAdmin ? "remove" : "add",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Erreur inconnue");
      }

      if (data?.success) {
        setUsers(prev =>
          prev.map(u =>
            u.id === userId ? { ...u, isAdmin: !currentIsAdmin } : u
          )
        );
        toast.success(currentIsAdmin ? "Rôle admin retiré" : "Rôle admin ajouté");
      }
    } catch (error) {
      console.error("Error toggling admin role:", error);
      toast.error("Erreur lors de la modification du rôle");
    } finally {
      setUpdatingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  useEffect(() => {
    if (isOpen && users.length === 0) {
      fetchUsers();
    }
  }, [isOpen]);

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Don't render if not a super admin
  if (!isSuperAdmin) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between p-4 h-auto bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/30"
        >
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-400" />
            <span className="font-semibold text-amber-200">Gestion des Administrateurs</span>
            <span className="text-xs text-amber-400/70 ml-2">(Super Admin)</span>
          </div>
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-amber-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-amber-400" />
          )}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-4 space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={fetchUsers}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Chargement des utilisateurs...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm ? "Aucun utilisateur trouvé" : "Aucun utilisateur inscrit"}
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {filteredUsers.map((user) => {
              const isSuperAdminUser = SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase());
              const isUpdating = updatingUsers.has(user.id);

              return (
                <div
                  key={user.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    user.isAdmin
                      ? "bg-primary/10 border-primary/30"
                      : "bg-muted/30 border-border"
                  } ${isSuperAdminUser ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={user.isAdmin}
                      disabled={isSuperAdminUser || isUpdating}
                      onCheckedChange={() => toggleAdminRole(user.id, user.isAdmin)}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{user.email}</span>
                        {user.isAdmin && (
                          <Shield className="w-4 h-4 text-primary" />
                        )}
                        {isSuperAdminUser && (
                          <Crown className="w-4 h-4 text-amber-400" />
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Inscrit le {new Date(user.created_at).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </div>
                  {isUpdating && (
                    <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">
            <Crown className="w-3 h-3 inline mr-1 text-amber-400" />
            Les Super Admins ne peuvent pas être modifiés
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default AdminRoleManager;
