import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface UseAdminOptions {
  studioId?: string | null;
}

export const useAdmin = (options?: UseAdminOptions) => {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const studioId = options?.studioId;

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (authLoading) return;
      
      if (!user) {
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setLoading(false);
        return;
      }

      try {
        // If studioId provided, check studio membership
        if (studioId) {
          const { data: memberData } = await supabase
            .from("studio_members")
            .select("role")
            .eq("studio_id", studioId)
            .eq("user_id", user.id)
            .single();

          if (memberData) {
            setIsAdmin(["owner", "admin"].includes(memberData.role));
            setIsSuperAdmin(memberData.role === "owner");
          } else {
            setIsAdmin(false);
            setIsSuperAdmin(false);
          }
          setLoading(false);
          return;
        }

        // Fallback: check platform-level roles
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (error) {
          setIsAdmin(false);
          setIsSuperAdmin(false);
        } else {
          const roles = data?.map(r => r.role) || [];
          setIsAdmin(roles.includes("admin") || roles.includes("superadmin"));
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
  }, [user, authLoading, studioId]);

  return { isAdmin, isSuperAdmin, loading: loading || authLoading, user };
};
