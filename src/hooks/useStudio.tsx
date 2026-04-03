import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Studio {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  address: string | null;
  city: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  stripe_publishable_key: string | null;
  google_calendar_id: string | null;
  subscription_status: string;
  is_active: boolean;
}

interface StudioContextType {
  studio: Studio | null;
  studioId: string | null;
  loading: boolean;
  error: string | null;
  isStudioAdmin: boolean;
  isStudioOwner: boolean;
  studioRole: string | null;
  refetch: () => Promise<void>;
}

const StudioContext = createContext<StudioContextType>({
  studio: null,
  studioId: null,
  loading: true,
  error: null,
  isStudioAdmin: false,
  isStudioOwner: false,
  studioRole: null,
  refetch: async () => {},
});

export const StudioProvider = ({ children }: { children: ReactNode }) => {
  const { studioSlug } = useParams<{ studioSlug: string }>();
  const { user } = useAuth();
  const [studio, setStudio] = useState<Studio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStudioAdmin, setIsStudioAdmin] = useState(false);
  const [isStudioOwner, setIsStudioOwner] = useState(false);
  const [studioRole, setStudioRole] = useState<string | null>(null);

  const fetchStudio = async () => {
    if (!studioSlug) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch studio by slug
      const { data: studioData, error: studioError } = await supabase
        .from("studios")
        .select("*")
        .eq("slug", studioSlug)
        .eq("is_active", true)
        .single();

      if (studioError || !studioData) {
        setError("Studio non trouvé");
        setStudio(null);
        setLoading(false);
        return;
      }

      // Check if subscription is active
      if (!["active", "trialing"].includes(studioData.subscription_status)) {
        setError("Ce studio n'est plus actif");
        setStudio(null);
        setLoading(false);
        return;
      }

      setStudio(studioData as Studio);

      // Check user's role in this studio
      if (user) {
        const { data: memberData } = await supabase
          .from("studio_members")
          .select("role")
          .eq("studio_id", studioData.id)
          .eq("user_id", user.id)
          .single();

        if (memberData) {
          setStudioRole(memberData.role);
          setIsStudioAdmin(["owner", "admin"].includes(memberData.role));
          setIsStudioOwner(memberData.role === "owner");
        } else {
          setStudioRole(null);
          setIsStudioAdmin(false);
          setIsStudioOwner(false);
        }
      }
    } catch (err) {
      console.error("Error fetching studio:", err);
      setError("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudio();
  }, [studioSlug, user]);

  // Apply studio branding via CSS variables
  useEffect(() => {
    if (studio) {
      document.documentElement.style.setProperty("--studio-primary", studio.primary_color);
      document.documentElement.style.setProperty("--studio-secondary", studio.secondary_color);
      document.documentElement.style.setProperty("--studio-bg", studio.background_color);
      document.title = studio.name;
    }
  }, [studio]);

  return (
    <StudioContext.Provider
      value={{
        studio,
        studioId: studio?.id || null,
        loading,
        error,
        isStudioAdmin,
        isStudioOwner,
        studioRole,
        refetch: fetchStudio,
      }}
    >
      {children}
    </StudioContext.Provider>
  );
};

export const useStudio = () => {
  const context = useContext(StudioContext);
  if (!context) {
    throw new Error("useStudio must be used within a StudioProvider");
  }
  return context;
};
