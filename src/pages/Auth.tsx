import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Mail, Lock, ArrowLeft, CheckCircle, Chrome, User, Phone } from "lucide-react";
import { useTranslation } from "react-i18next";

type AuthView = "login" | "signup" | "forgot-password" | "reset-password";

const Auth = () => {
  // Detect if we're inside a studio context (URL param or query string)
  const { studioSlug } = useParams<{ studioSlug: string }>();
  const studioFromQuery = new URLSearchParams(window.location.search).get("studio");
  const effectiveStudioSlug = studioSlug || studioFromQuery;
  const isPlatformAuth = !effectiveStudioSlug;
  const [view, setView] = useState<AuthView>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    // Check if there's a saved email in localStorage
    const savedEmail = localStorage.getItem("rememberedEmail");
    return !!savedEmail;
  });
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    // Load remembered email if exists
    const savedEmail = localStorage.getItem("rememberedEmail");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }

    // Check URL for password reset — synchronous check before any redirect
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const isRecovery = hashParams.get("type") === "recovery";
    if (isRecovery) {
      setView("reset-password");
    }
    
    const redirectAfterLogin = async (userId: string) => {
      if (effectiveStudioSlug) {
        // Client came from a studio page → redirect back to that studio
        navigate(`/${effectiveStudioSlug}`);
      } else {
        // Check if user came from a studio (saved in localStorage)
        const savedStudio = localStorage.getItem("auth_return_studio");
        if (savedStudio) {
          localStorage.removeItem("auth_return_studio");
          navigate(`/${savedStudio}`);
          return;
        }
        
        // Platform auth → check if user owns/admin a studio
        const { data: membership } = await supabase
          .from("studio_members")
          .select("studio_id, studios(slug)")
          .eq("user_id", userId)
          .limit(1)
          .single();
        
        if (membership && (membership as any).studios?.slug) {
          navigate(`/${(membership as any).studios.slug}`);
        } else {
          // User is a client, not a studio owner → go to landing page
          // Only /register-studio is for users who explicitly want to create a studio
          navigate("/");
        }
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          setView("reset-password");
        } else if (session?.user && !isRecovery && view !== "reset-password") {
          redirectAfterLogin(session.user.id);
        }
      }
    );

    // Check for existing session — skip redirect if we're in recovery mode
    if (!isRecovery) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user && view !== "reset-password") {
          redirectAfterLogin(session.user.id);
        }
      });
    }

    return () => subscription.unsubscribe();
  }, [navigate, view]);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string) => {
    if (password.length < 12) return false;
    const hasUppercase = /[A-Z]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    return hasUppercase && hasSpecial;
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(email)) {
      toast({
        title: "Email invalide",
        description: "Veuillez entrer une adresse email valide.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });

      if (error) throw error;
      setResetEmailSent(true);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'envoyer l'email de réinitialisation.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePassword(newPassword)) {
      toast({
        title: "Mot de passe invalide",
        description: "Min. 12 caractères, 1 majuscule et 1 caractère spécial requis.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
      
      toast({
        title: "Mot de passe modifié",
        description: "Votre mot de passe a été mis à jour avec succès.",
      });
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de modifier le mot de passe.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(email)) {
      toast({
        title: "Email invalide",
        description: "Veuillez entrer une adresse email valide.",
        variant: "destructive",
      });
      return;
    }

    if (!validatePassword(password)) {
      toast({
        title: "Mot de passe invalide",
        description: "Min. 12 caractères, 1 majuscule et 1 caractère spécial requis.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      if (view === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (!error) {
          // Save or remove email based on rememberMe checkbox
          if (rememberMe) {
            localStorage.setItem("rememberedEmail", email);
          } else {
            localStorage.removeItem("rememberedEmail");
          }
        }

        if (error) {
          if (error.message.includes("Email not confirmed")) {
            toast({
              title: "Email non confirmé",
              description: "Veuillez vérifier votre boîte mail et cliquer sur le lien de confirmation.",
              variant: "destructive",
            });
          } else if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "Identifiants incorrects",
              description: "Email ou mot de passe incorrect.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Erreur de connexion",
              description: error.message,
              variant: "destructive",
            });
          }
        }
      } else {
        if (!fullName.trim() || !phone.trim()) {
          toast({
            title: "Informations requises",
            description: "Merci d'indiquer votre nom et votre numéro de téléphone.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        // Save studio context for redirect after email confirmation
        if (effectiveStudioSlug) {
          localStorage.setItem("auth_return_studio", effectiveStudioSlug);
        }
        
        const redirectUrl = effectiveStudioSlug 
          ? `${window.location.origin}/${effectiveStudioSlug}`
          : `${window.location.origin}/`;
        
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              full_name: fullName.trim(),
              phone: phone.trim(),
              ...(effectiveStudioSlug ? { registered_from_studio: effectiveStudioSlug } : {}),
            },
          },
        });

        if (error) {
          if (error.message.includes("already registered")) {
            toast({
              title: "Compte existant",
              description: "Un compte existe déjà avec cet email. Essayez de vous connecter.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Erreur d'inscription",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          setEmailSent(true);
        }
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Email sent confirmation (signup)
  if (emailSent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-neon-cyan/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-neon-cyan" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-4">
              Vérifiez votre email
            </h2>
            <p className="text-muted-foreground mb-6">
              Nous avons envoyé un lien de confirmation à <span className="text-neon-cyan font-medium">{email}</span>. 
              Cliquez sur le lien dans l'email pour activer votre compte.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Vérifiez également votre dossier spam si vous ne trouvez pas l'email.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setEmailSent(false);
                setView("login");
              }}
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour à la connexion
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Reset email sent confirmation
  if (resetEmailSent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-neon-cyan/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Mail className="w-8 h-8 text-neon-cyan" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-4">
              Email envoyé
            </h2>
            <p className="text-muted-foreground mb-6">
              Si un compte existe avec l'adresse <span className="text-neon-cyan font-medium">{email}</span>, 
              vous recevrez un lien pour réinitialiser votre mot de passe.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Vérifiez également votre dossier spam.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setResetEmailSent(false);
                setView("login");
              }}
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour à la connexion
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Reset password form
  if (view === "reset-password") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-2xl p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-neon-cyan to-neon-gold bg-clip-text text-transparent">
                {isPlatformAuth ? "StudioBooking" : (effectiveStudioSlug || "Studio")}
              </h1>
              <p className="text-muted-foreground mt-2">
                Créez un nouveau mot de passe
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-foreground">Nouveau mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 12 car., 1 majuscule, 1 spécial"
                    className="pl-10 pr-10"
                    required
                    minLength={12}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Min. 12 caractères, 1 majuscule, 1 caractère spécial
                </p>
              </div>

              <Button
                type="submit"
                className="w-full bg-neon-cyan hover:bg-neon-cyan/80 text-background font-semibold"
                disabled={loading}
              >
                {loading ? "Modification..." : "Modifier le mot de passe"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Forgot password form
  if (view === "forgot-password") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <button
            onClick={() => setView("login")}
            className="flex items-center text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à la connexion
          </button>

          <div className="bg-card border border-border rounded-2xl p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-neon-cyan to-neon-gold bg-clip-text text-transparent">
                {isPlatformAuth ? "StudioBooking" : (effectiveStudioSlug || "Studio")}
              </h1>
              <p className="text-muted-foreground mt-2">
                Récupération de mot de passe
              </p>
            </div>

            <form onSubmit={handleForgotPassword} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    className="pl-10"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Entrez l'email associé à votre compte pour recevoir un lien de réinitialisation.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full bg-neon-cyan hover:bg-neon-cyan/80 text-background font-semibold"
                disabled={loading}
              >
                {loading ? "Envoi..." : "Envoyer le lien"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Login / Signup form
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back button */}
        <button
          onClick={() => navigate(effectiveStudioSlug ? `/${effectiveStudioSlug}` : "/")}
          className="flex items-center text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {effectiveStudioSlug ? "Retour au studio" : "Retour à l'accueil"}
        </button>

        <div className="bg-card border border-border rounded-2xl p-8">
          {/* Logo/Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-neon-cyan to-neon-gold bg-clip-text text-transparent">
              {isPlatformAuth ? "StudioBooking" : (effectiveStudioSlug || "Studio")}
            </h1>
            <p className="text-muted-foreground mt-2">
              {view === "login" ? "Connectez-vous à votre compte" : "Créez votre compte"}
            </p>
          </div>


          {/* Google OAuth Button */}
          <Button
            type="button"
            variant="outline"
            className="w-full mb-4 border-border hover:bg-muted"
            onClick={async () => {
              setLoading(true);
              try {
                const redirectTo = effectiveStudioSlug 
                  ? `${window.location.origin}/${effectiveStudioSlug}`
                  : `${window.location.origin}/auth`;
                const { error } = await supabase.auth.signInWithOAuth({
                  provider: 'google',
                  options: {
                    redirectTo,
                  },
                });
                if (error) {
                  const msg = error.message.includes("provider is not enabled")
                    ? "La connexion Google n'est pas encore configurée. Veuillez utiliser votre email et mot de passe."
                    : error.message;
                  toast({
                    title: "Connexion Google indisponible",
                    description: msg,
                    variant: "destructive",
                  });
                  setLoading(false);
                }
              } catch (err: any) {
                toast({
                  title: "Erreur",
                  description: "Impossible de se connecter avec Google. Veuillez réessayer.",
                  variant: "destructive",
                });
                setLoading(false);
              }
            }}
            disabled={loading}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continuer avec Google
          </Button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {view === "signup" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-foreground">Nom complet</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Votre nom et prénom"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-foreground">Numéro de téléphone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+32 ..."
                      className="pl-10"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ces informations seront utilisées pour pré-remplir vos réservations.
                  </p>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-foreground">Mot de passe</Label>
                {view === "login" && (
                  <button
                    type="button"
                    onClick={() => setView("forgot-password")}
                    className="text-xs text-neon-cyan hover:underline"
                  >
                    Mot de passe oublié ?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Min. 12 caractères, 1 majuscule, 1 caractère spécial
              </p>
            </div>

            {view === "login" && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rememberMe"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                />
                <Label
                  htmlFor="rememberMe"
                  className="text-sm text-muted-foreground cursor-pointer"
                >
                  Garder ma session active
                </Label>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-neon-cyan hover:bg-neon-cyan/80 text-background font-semibold"
              disabled={loading}
            >
              {loading
                ? "Chargement..."
                : view === "login"
                ? "Se connecter"
                : "Créer mon compte"}
            </Button>
          </form>

          {/* Toggle */}
          <div className="mt-6 text-center">
            <p className="text-muted-foreground">
              {view === "login" ? "Pas encore de compte ?" : "Déjà un compte ?"}
              <button
                type="button"
                onClick={() => setView(view === "login" ? "signup" : "login")}
                className="ml-2 text-neon-cyan hover:underline font-medium"
              >
                {view === "login" ? "S'inscrire" : "Se connecter"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
