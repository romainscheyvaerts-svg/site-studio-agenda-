import { useState, useEffect } from "react";
import { useStudio } from "@/hooks/useStudio";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save, Settings, CreditCard, Calendar, Mail, Bot, Palette, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const StudioSettings = () => {
  const { studio, studioId, isStudioOwner, isStudioAdmin, refetch } = useStudio();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("general");

  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [slug, setSlug] = useState("");
  
  // Branding
  const [primaryColor, setPrimaryColor] = useState("#06b6d4");
  const [secondaryColor, setSecondaryColor] = useState("#8b5cf6");
  const [backgroundColor, setBackgroundColor] = useState("#000000");

  // Payment
  const [stripePublishableKey, setStripePublishableKey] = useState("");
  const [stripeSecretKey, setStripeSecretKey] = useState("");
  const [paypalClientId, setPaypalClientId] = useState("");
  const [paypalClientSecret, setPaypalClientSecret] = useState("");

  // Google
  const [googleCalendarId, setGoogleCalendarId] = useState("");
  const [googlePatronCalendarId, setGooglePatronCalendarId] = useState("");
  const [googleDriveFolderId, setGoogleDriveFolderId] = useState("");
  const [googleServiceAccountKey, setGoogleServiceAccountKey] = useState("");

  // Email
  const [resendApiKey, setResendApiKey] = useState("");
  const [resendFromEmail, setResendFromEmail] = useState("");

  // AI
  const [geminiApiKey, setGeminiApiKey] = useState("");

  useEffect(() => {
    if (studio) {
      setName(studio.name || "");
      setDescription(studio.description || "");
      setAddress(studio.address || "");
      setCity(studio.city || "");
      setPhone(studio.phone || "");
      setEmail(studio.email || "");
      setSlug(studio.slug || "");
      setPrimaryColor(studio.primary_color || "#06b6d4");
      setSecondaryColor(studio.secondary_color || "#8b5cf6");
      setBackgroundColor(studio.background_color || "#000000");
    }
    // Load sensitive keys from DB
    if (studioId) {
      loadSensitiveKeys();
    }
  }, [studio, studioId]);

  const loadSensitiveKeys = async () => {
    if (!studioId) return;
    const { data } = await supabase
      .from("studios")
      .select("stripe_publishable_key, stripe_secret_key, paypal_client_id, paypal_client_secret, google_calendar_id, google_patron_calendar_id, google_drive_parent_folder_id, google_service_account_key, resend_api_key, resend_from_email, gemini_api_key")
      .eq("id", studioId)
      .single();
    
    if (data) {
      setStripePublishableKey(data.stripe_publishable_key || "");
      setStripeSecretKey(data.stripe_secret_key || "");
      setPaypalClientId(data.paypal_client_id || "");
      setPaypalClientSecret(data.paypal_client_secret || "");
      setGoogleCalendarId(data.google_calendar_id || "");
      setGooglePatronCalendarId(data.google_patron_calendar_id || "");
      setGoogleDriveFolderId(data.google_drive_parent_folder_id || "");
      setGoogleServiceAccountKey(data.google_service_account_key || "");
      setResendApiKey(data.resend_api_key || "");
      setResendFromEmail(data.resend_from_email || "");
      setGeminiApiKey(data.gemini_api_key || "");
    }
  };

  const handleSave = async () => {
    if (!studioId) return;
    setLoading(true);
    try {
      const updateData: any = {};
      
      if (activeTab === "general") {
        Object.assign(updateData, { name, slug, description, address, city, phone, email });
      } else if (activeTab === "branding") {
        Object.assign(updateData, { primary_color: primaryColor, secondary_color: secondaryColor, background_color: backgroundColor });
      } else if (activeTab === "payment") {
        Object.assign(updateData, { 
          stripe_publishable_key: stripePublishableKey || null,
          stripe_secret_key: stripeSecretKey || null,
          paypal_client_id: paypalClientId || null,
          paypal_client_secret: paypalClientSecret || null,
        });
      } else if (activeTab === "google") {
        Object.assign(updateData, { 
          google_calendar_id: googleCalendarId || null,
          google_patron_calendar_id: googlePatronCalendarId || null,
          google_drive_parent_folder_id: googleDriveFolderId || null,
          google_service_account_key: googleServiceAccountKey || null,
        });
      } else if (activeTab === "email") {
        Object.assign(updateData, { resend_api_key: resendApiKey || null, resend_from_email: resendFromEmail || null });
      } else if (activeTab === "ai") {
        Object.assign(updateData, { gemini_api_key: geminiApiKey || null });
      }

      const { error } = await supabase.from("studios").update(updateData).eq("id", studioId);
      if (error) throw error;
      
      await refetch();
      toast({ title: "✅ Paramètres sauvegardés !" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!isStudioAdmin) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-gray-400">Accès réservé aux administrateurs du studio.</p>
      </div>
    );
  }

  const tabs = [
    { id: "general", label: "Général", icon: Settings },
    { id: "branding", label: "Apparence", icon: Palette },
    { id: "payment", label: "Paiements", icon: CreditCard },
    { id: "google", label: "Google", icon: Calendar },
    { id: "email", label: "Emails", icon: Mail },
    { id: "ai", label: "IA / Chatbot", icon: Bot },
  ];

  const InputField = ({ label, value, onChange, type = "text", placeholder = "" }: any) => (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e: any) => onChange(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none text-sm"
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link to={`/${studio?.slug}`} className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Paramètres du studio</h1>
            <p className="text-gray-400 text-sm">{studio?.name}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 overflow-x-auto pb-2">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                activeTab === id ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-4">
          {activeTab === "general" && (
            <>
              <InputField label="Nom du studio" value={name} onChange={setName} placeholder="Mon Studio" />
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">URL de votre studio</label>
                <div className="flex items-center bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                  <span className="px-3 text-gray-500 text-sm">studiobooking.com/</span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e: any) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    className="flex-1 bg-transparent px-2 py-2.5 text-white focus:outline-none text-sm"
                    placeholder="mon-studio"
                  />
                </div>
              </div>
              <InputField label="Description" value={description} onChange={setDescription} placeholder="Studio d'enregistrement professionnel..." />
              <InputField label="Adresse" value={address} onChange={setAddress} placeholder="123 rue de la Musique" />
              <InputField label="Ville" value={city} onChange={setCity} placeholder="Bruxelles" />
              <InputField label="Téléphone" value={phone} onChange={setPhone} placeholder="+32 xxx xxx xxx" />
              <InputField label="Email" value={email} onChange={setEmail} type="email" placeholder="contact@studio.com" />
            </>
          )}

          {activeTab === "branding" && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Couleur principale</label>
                  <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-full h-10 rounded cursor-pointer" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Couleur secondaire</label>
                  <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="w-full h-10 rounded cursor-pointer" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Fond</label>
                  <input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className="w-full h-10 rounded cursor-pointer" />
                </div>
              </div>
              <div className="mt-4 p-4 rounded-xl" style={{ background: backgroundColor }}>
                <p style={{ color: primaryColor }} className="font-bold text-lg">Aperçu du texte principal</p>
                <p style={{ color: secondaryColor }} className="text-sm">Aperçu du texte secondaire</p>
              </div>
            </>
          )}

          {activeTab === "payment" && (
            <>
              <p className="text-sm text-gray-400 mb-4">
                💳 Configurez vos propres comptes Stripe et PayPal pour recevoir les paiements de vos clients directement sur votre compte.
              </p>
              <div className="border-b border-gray-800 pb-4 mb-4">
                <h3 className="font-semibold text-cyan-400 mb-3">Stripe</h3>
                <InputField label="Clé publique (pk_...)" value={stripePublishableKey} onChange={setStripePublishableKey} placeholder="pk_live_..." />
                <div className="mt-3">
                  <InputField label="Clé secrète (sk_...)" value={stripeSecretKey} onChange={setStripeSecretKey} type="password" placeholder="sk_live_..." />
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-cyan-400 mb-3">PayPal</h3>
                <InputField label="Client ID" value={paypalClientId} onChange={setPaypalClientId} placeholder="AX..." />
                <div className="mt-3">
                  <InputField label="Client Secret" value={paypalClientSecret} onChange={setPaypalClientSecret} type="password" placeholder="EK..." />
                </div>
              </div>
            </>
          )}

          {activeTab === "google" && (
            <>
              <p className="text-sm text-gray-400 mb-4">
                📅 Connectez votre Google Calendar et Google Drive pour synchroniser les réservations et stocker les fichiers clients.
              </p>
              <InputField label="Google Calendar ID (principal)" value={googleCalendarId} onChange={setGoogleCalendarId} placeholder="xxx@group.calendar.google.com" />
              <InputField label="Google Calendar ID (patron)" value={googlePatronCalendarId} onChange={setGooglePatronCalendarId} placeholder="xxx@group.calendar.google.com" />
              <InputField label="Google Drive Parent Folder ID" value={googleDriveFolderId} onChange={setGoogleDriveFolderId} placeholder="1ABC..." />
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Clé Service Account (JSON)</label>
                <textarea
                  value={googleServiceAccountKey}
                  onChange={(e) => setGoogleServiceAccountKey(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none text-sm font-mono h-32"
                  placeholder='{"type": "service_account", ...}'
                />
              </div>
            </>
          )}

          {activeTab === "email" && (
            <>
              <p className="text-sm text-gray-400 mb-4">
                ✉️ Configurez Resend pour envoyer des emails de confirmation automatiques à vos clients.
              </p>
              <InputField label="Resend API Key" value={resendApiKey} onChange={setResendApiKey} type="password" placeholder="re_..." />
              <InputField label="Email expéditeur" value={resendFromEmail} onChange={setResendFromEmail} type="email" placeholder="noreply@votre-domaine.com" />
            </>
          )}

          {activeTab === "ai" && (
            <>
              <p className="text-sm text-gray-400 mb-4">
                🤖 Ajoutez votre clé Gemini pour activer le chatbot IA sur votre page studio.
              </p>
              <InputField label="Google Gemini API Key" value={geminiApiKey} onChange={setGeminiApiKey} type="password" placeholder="AIza..." />
            </>
          )}

          <div className="pt-4">
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-600 hover:to-violet-600 text-white font-bold py-3 px-6 rounded-xl transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {loading ? "Sauvegarde..." : "Sauvegarder"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudioSettings;
