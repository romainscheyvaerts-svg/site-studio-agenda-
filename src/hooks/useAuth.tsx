import { useState, useEffect, createContext, useContext, ReactNode, useRef } from "react";
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
  const driveCreationAttempted = useRef<Set<string>>(new Set());

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

  // Create Drive folder for new user
  const createDriveFolderForUser = async (accessToken: string, userEmail: string) => {
    // Prevent multiple attempts for the same user in the same session
    if (driveCreationAttempted.current.has(userEmail)) {
      return;
    }
    driveCreationAttempted.current.add(userEmail);

    try {
      console.log("[AUTH] Creating Drive folder for user:", userEmail);
      
      const { data, error } = await supabase.functions.invoke("create-client-drive-on-signup", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (error) {
        console.error("[AUTH] Error creating Drive folder:", error);
        return;
      }

      if (data?.success) {
        if (data.alreadyExists) {
          console.log("[AUTH] Drive folder already exists for:", userEmail);
        } else {
          console.log("[AUTH] Drive folder created successfully for:", userEmail);
        }
      }
    } catch (error) {
      console.error("[AUTH] Failed to create Drive folder:", error);
    }
  };

  useEffect(() => {
    const handleOAuthCallback = async () => {
      // Check if there's a hash with access_token (OAuth callback)
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        // Parse the hash to extract tokens
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          try {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (!error) {
              // Clear the hash from URL immediately for security
              window.history.replaceState(null, '', window.location.pathname);
              
              // Check if user needs to be redirected back to a studio page
              // This handles the case where Google OAuth redirects to the wrong URL
              const returnStudio = localStorage.getItem("auth_return_studio");
              const currentPath = window.location.pathname;
              
              // Only redirect if we're NOT already on a studio page or auth page for that studio
              if (returnStudio && !currentPath.startsWith(`/${returnStudio}`)) {
                localStorage.removeItem("auth_return_studio");
                window.location.href = `/${returnStudio}`;
                return;
              }
              
              // If we're on the root and there's a saved studio, redirect
              if (returnStudio && (currentPath === '/' || currentPath === '/auth')) {
                localStorage.removeItem("auth_return_studio");
                window.location.href = `/${returnStudio}`;
                return;
              }
            }
          } catch {
            // Silent fail - auth state listener will handle the state
          }
        }
      }
    };

    // Handle OAuth callback first
    handleOAuthCallback();

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Log auth events (without exposing PII in console)
        if (event === "SIGNED_IN" && session?.user) {
          logActivity("login", session.user.email, session.user.id);
          
          // Create Drive folder for user (will check if already exists)
          if (session.access_token && session.user.email) {
            // Use setTimeout to avoid blocking the auth flow
            setTimeout(() => {
              createDriveFolderForUser(session.access_token, session.user.email!);
            }, 1000);
          }
        } else if (event === "SIGNED_OUT") {
          logActivity("logout");
          // Clear the drive creation tracking on logout
          driveCreationAttempted.current.clear();
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        setUser(session.user);
        
        // Also attempt to create Drive folder for existing sessions
        // This ensures folders are created for users who signed up before this feature
        if (session.access_token && session.user.email) {
          setTimeout(() => {
            createDriveFolderForUser(session.access_token, session.user.email!);
          }, 2000);
        }
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    // Ensure local auth state is cleared even if the listener misses the event
    setUser(null);
    setSession(null);
    // Clear the drive creation tracking on logout
    driveCreationAttempted.current.clear();
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
