import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const useAdmin = () => {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (authLoading) return;
      
      if (!user) {
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setLoading(false);
        return;
      }

      // Check admin and superadmin roles in user_roles table
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (error) {
          console.error("Error checking admin status:", error);
          setIsAdmin(false);
          setIsSuperAdmin(false);
        } else {
          const roles = data?.map(r => r.role) || [];
          // User is admin if they have admin OR superadmin role
          setIsAdmin(roles.includes("admin") || roles.includes("superadmin"));
          // User is superadmin only if they have superadmin role
          setIsSuperAdmin(roles.includes("superadmin"));
        }
      } catch (err) {
        console.error("Admin check failed:", err);
        setIsAdmin(false);
        setIsSuperAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [user, authLoading]);

  return { isAdmin, isSuperAdmin, loading: loading || authLoading, user };
};
