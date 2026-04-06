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
  stripe_secret_key: string | null;
  paypal_client_id: string | null;
  paypal_client_secret: string | null;
  google_calendar_id: string | null;
  google_patron_calendar_id: string | null;
  google_drive_parent_folder_id: string | null;
  google_service_account_key: string | null;
  resend_api_key: string | null;
  resend_from_email: string | null;
  gemini_api_key: string | null;
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
      if (studioData.subscription_status === "pending_approval") {
        setError("Ce studio est en attente de validation par l'équipe StudioBooking.");
        setStudio(null);
        setLoading(false);
        return;
      }
      if (studioData.subscription_status === "rejected") {
        setError("Ce studio n'a pas été approuvé.");
        setStudio(null);
        setLoading(false);
        return;
      }
      if (studioData.subscription_status === "suspended") {
        setError("Ce studio est temporairement suspendu. Veuillez réessayer plus tard.");
        setStudio(null);
        setLoading(false);
        return;
      }
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

  // Convert hex color to HSL values string (e.g. "185 100% 50%")
  const hexToHSL = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return "185 100% 50%";
    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  };

  // Apply studio branding via CSS variables
  useEffect(() => {
    if (studio) {
      // Set HSL values for Tailwind CSS variables
      if (studio.primary_color) {
        document.documentElement.style.setProperty("--primary", hexToHSL(studio.primary_color));
      }
      if (studio.secondary_color) {
        document.documentElement.style.setProperty("--accent", hexToHSL(studio.secondary_color));
      }
      if (studio.background_color) {
        document.documentElement.style.setProperty("--background", hexToHSL(studio.background_color));
      }
      // Keep legacy variables
      document.documentElement.style.setProperty("--studio-primary", studio.primary_color);
      document.documentElement.style.setProperty("--studio-secondary", studio.secondary_color);
      document.documentElement.style.setProperty("--studio-bg", studio.background_color);
      // Apply font family
      const s = studio as any;
      if (s.font_family) {
        document.documentElement.style.setProperty("--font-family", s.font_family);
        document.body.style.fontFamily = `${s.font_family}, sans-serif`;
      }
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
