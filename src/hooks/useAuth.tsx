import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Log activity
  const logActivity = async (action: string, userEmail?: string, userId?: string) => {
    try {
      await supabase.from("activity_logs").insert({
        action,
        user_email: userEmail || null,
        user_id: userId || null,
        ip_address: "client",
        path: window.location.pathname,
      });
    } catch (error) {
      console.error("Failed to log activity:", error);
    }
  };

  useEffect(() => {
    // Check if there's a hash with access_token (OAuth callback)
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      console.log("[Auth] Detected OAuth callback with tokens in URL");
    }

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("[Auth] Event:", event, "Session:", session ? "exists" : "null", "User:", session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Clear the hash from URL after successful auth
        if (event === "SIGNED_IN" && session?.user && window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname);
        }
        
        // Log auth events
        if (event === "SIGNED_IN" && session?.user) {
          logActivity("login", session.user.email, session.user.id);
        } else if (event === "SIGNED_OUT") {
          logActivity("logout");
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log("[Auth] getSession result:", session ? "exists" : "null", "Error:", error?.message || "none");
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    // Ensure local auth state is cleared even if the listener misses the event
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
