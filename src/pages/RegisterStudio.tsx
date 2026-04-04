import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Headphones, ArrowRight, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const RegisterStudio = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  
  // Auto-skip to step 2 when user is already logged in
  useEffect(() => {
    if (user) setStep(2);
  }, [user]);
  const [authMode, setAuthMode] = useState<"signup" | "login" | "forgot">("signup");
  const [forgotEmailSent, setForgotEmailSent] = useState(false);
  
  // Auth fields
  const [email, setEmail] = useState(() => localStorage.getItem("rememberedEmail") || "");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem("rememberedEmail"));
  
  // Studio fields
  const [studioName, setStudioName] = useState("");
  const [studioSlug, setStudioSlug] = useState("");
  const [studioCity, setStudioCity] = useState("");
  const [studioPhone, setStudioPhone] = useState("");

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const handleNameChange = (name: string) => {
    setStudioName(name);
    if (!studioSlug || studioSlug === generateSlug(studioName)) {
      setStudioSlug(generateSlug(name));
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({ title: "Email requis", description: "Entrez votre email pour recevoir le lien de réinitialisation.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      setForgotEmailSent(true);
      toast({ title: "📧 Email envoyé !", description: "Vérifiez votre boîte mail pour réinitialiser votre mot de passe." });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast({ title: "Identifiants incorrects", description: "Email ou mot de passe incorrect.", variant: "destructive" });
        } else {
          toast({ title: "Erreur", description: error.message, variant: "destructive" });
        }
      } else {
        // Save or clear remembered email
        if (rememberMe) {
          localStorage.setItem("rememberedEmail", email);
        } else {
          localStorage.removeItem("rememberedEmail");
        }
        setStep(2);
        toast({ title: "Connecté !", description: "Configurez maintenant votre studio." });
      }
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password) return;
    if (password.length < 12 || !/[A-Z]/.test(password) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      toast({ title: "Mot de passe invalide", description: "Min. 12 caractères, 1 majuscule et 1 caractère spécial requis.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/register-studio`,
        }
      });
      if (error) throw error;
      
      // If user already has a session (auto-confirmed or already exists)
      if (data.session) {
        setStep(2);
        toast({ title: "Compte créé !", description: "Configurez maintenant votre studio." });
      } else {
        // Email confirmation required
        toast({ 
          title: "📧 Vérifiez votre email", 
          description: `Un lien de confirmation a été envoyé à ${email}. Cliquez dessus puis revenez ici.`,
        });
      }
    } catch (err: any) {
      if (err.message?.includes("already registered")) {
        // Try to sign in instead
        const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
        if (loginErr) {
          toast({ title: "Compte existant", description: "Un compte existe déjà. Vérifiez votre mot de passe.", variant: "destructive" });
        } else {
          setStep(2);
          toast({ title: "Connecté !", description: "Configurez maintenant votre studio." });
        }
      } else {
        toast({ title: "Erreur", description: err.message, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStudio = async () => {
    if (!studioName || !studioSlug) return;
    setLoading(true);
    
    const currentUser = user || (await supabase.auth.getUser()).data.user;
    if (!currentUser) {
      toast({ title: "Erreur", description: "Vous devez être connecté", variant: "destructive" });
      setStep(1);
      setLoading(false);
      return;
    }

    try {
      // Check slug availability
      const { data: existing } = await supabase
        .from("studios")
        .select("id")
        .eq("slug", studioSlug)
        .maybeSingle();

      if (existing) {
        toast({ title: "Slug déjà pris", description: "Choisissez un autre nom d'URL.", variant: "destructive" });
        setLoading(false);
        return;
      }

      // Create studio
      const { data: studio, error: studioError } = await supabase
        .from("studios")
        .insert({
          name: studioName,
          slug: studioSlug,
          city: studioCity || null,
          phone: studioPhone || null,
          email: currentUser.email || null,
          subscription_status: "pending_approval",
        })
        .select()
        .single();

      if (studioError) throw studioError;

      // Add user as owner
      const { error: memberError } = await supabase
        .from("studio_members")
        .insert({
          studio_id: studio.id,
          user_id: currentUser.id,
          role: "owner",
        });

      if (memberError) throw memberError;

      // Also give platform admin role
      await supabase
        .from("user_roles")
        .insert({ user_id: currentUser.id, role: "admin" })
        .single();

      toast({ 
        title: "📋 Demande envoyée !", 
        description: `Votre studio "${studioName}" est en attente de validation par l'équipe StudioBooking. Vous serez notifié par email.` 
      });
      
      // Redirect to a pending page
      navigate("/studio-pending");
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white flex flex-col">
      {/* Header */}
      <nav className="flex items-center justify-between p-6 max-w-7xl mx-auto w-full">
        <Link to="/" className="flex items-center gap-2">
          <Headphones className="w-8 h-8 text-cyan-400" />
          <span className="text-xl font-bold">StudioBooking</span>
        </Link>
      </nav>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center px-6 pb-20">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-bold mb-2 text-center">Créer mon studio</h1>
          <p className="text-gray-400 text-center mb-8">
            {step === 1 
              ? (authMode === "forgot" 
                  ? "Réinitialisation du mot de passe" 
                  : authMode === "signup" ? "Étape 1/2 — Créez votre compte" : "Étape 1/2 — Connectez-vous")
              : "Étape 2/2 — Configurez votre studio"}
          </p>

          {/* Progress */}
          <div className="flex gap-2 mb-8">
            <div className={`h-1 flex-1 rounded ${step >= 1 ? "bg-cyan-500" : "bg-gray-700"}`} />
            <div className={`h-1 flex-1 rounded ${step >= 2 ? "bg-cyan-500" : "bg-gray-700"}`} />
          </div>

          {step === 1 && authMode === "forgot" && (
            <div className="space-y-4">
              {forgotEmailSent ? (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto">
                    <span className="text-3xl">📧</span>
                  </div>
                  <h3 className="text-xl font-bold">Email envoyé !</h3>
                  <p className="text-gray-400">
                    Si un compte existe avec <span className="text-cyan-400">{email}</span>, 
                    vous recevrez un lien pour réinitialiser votre mot de passe. Vérifiez aussi vos spams.
                  </p>
                  <button
                    onClick={() => { setAuthMode("login"); setForgotEmailSent(false); }}
                    className="text-cyan-400 hover:underline flex items-center justify-center gap-2 mx-auto"
                  >
                    <ArrowLeft className="w-4 h-4" /> Retour à la connexion
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-cyan-500 focus:outline-none"
                      placeholder="votre@email.com"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Entrez l'email de votre compte pour recevoir un lien de réinitialisation.
                    </p>
                  </div>
                  <button
                    onClick={handleForgotPassword}
                    disabled={loading || !email}
                    className="w-full bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-600 hover:to-violet-600 text-white font-bold py-3 px-6 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? "Envoi..." : "Envoyer le lien"} <ArrowRight className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode("login")}
                    className="w-full text-gray-400 hover:text-white flex items-center justify-center gap-2 text-sm"
                  >
                    <ArrowLeft className="w-4 h-4" /> Retour à la connexion
                  </button>
                </>
              )}
            </div>
          )}

          {step === 1 && authMode !== "forgot" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-cyan-500 focus:outline-none"
                  placeholder="votre@email.com"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-300">Mot de passe</label>
                  {authMode === "login" && (
                    <button
                      type="button"
                      onClick={() => setAuthMode("forgot")}
                      className="text-xs text-cyan-400 hover:underline"
                    >
                      Mot de passe oublié ?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-cyan-500 focus:outline-none"
                  placeholder="Min. 12 car., 1 majuscule, 1 spécial"
                />
              </div>
              {authMode === "login" && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-gray-400">Se souvenir de moi</span>
                </label>
              )}
              <button
                onClick={authMode === "signup" ? handleSignUp : handleLogin}
                disabled={loading || !email || !password}
                className="w-full bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-600 hover:to-violet-600 text-white font-bold py-3 px-6 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading 
                  ? (authMode === "signup" ? "Création..." : "Connexion...") 
                  : (authMode === "signup" ? "Créer mon compte" : "Se connecter")} <ArrowRight className="w-5 h-5" />
              </button>
              <p className="text-center text-sm text-gray-500">
                {authMode === "signup" ? "Déjà un compte ?" : "Pas encore de compte ?"}{" "}
                <button 
                  type="button"
                  onClick={() => setAuthMode(authMode === "signup" ? "login" : "signup")}
                  className="text-cyan-400 hover:underline"
                >
                  {authMode === "signup" ? "Se connecter" : "Créer un compte"}
                </button>
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Nom du studio *</label>
                <input
                  type="text"
                  value={studioName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-cyan-500 focus:outline-none"
                  placeholder="Ex: Make Music Studio"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">URL de votre studio *</label>
                <div className="flex items-center bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                  <span className="px-3 text-gray-500 text-sm">studiobooking.com/</span>
                  <input
                    type="text"
                    value={studioSlug}
                    onChange={(e) => setStudioSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    className="flex-1 bg-transparent px-2 py-3 text-white focus:outline-none"
                    placeholder="mon-studio"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Ville</label>
                <input
                  type="text"
                  value={studioCity}
                  onChange={(e) => setStudioCity(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-cyan-500 focus:outline-none"
                  placeholder="Ex: Bruxelles"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Téléphone</label>
                <input
                  type="tel"
                  value={studioPhone}
                  onChange={(e) => setStudioPhone(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-cyan-500 focus:outline-none"
                  placeholder="+32 xxx xxx xxx"
                />
              </div>
              <button
                onClick={handleCreateStudio}
                disabled={loading || !studioName || !studioSlug}
                className="w-full bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-600 hover:to-violet-600 text-white font-bold py-3 px-6 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? "Création..." : "🎵 Créer mon studio"} <ArrowRight className="w-5 h-5" />
              </button>
              {!user && (
                <button onClick={() => setStep(1)} className="w-full text-gray-400 hover:text-white flex items-center justify-center gap-2 text-sm">
                  <ArrowLeft className="w-4 h-4" /> Retour
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RegisterStudio;
