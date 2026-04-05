import { useState, useEffect } from "react";
import { useStudio } from "@/hooks/useStudio";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save, Settings, CreditCard, Calendar, Mail, Palette, ArrowLeft, Layout, Eye, EyeOff, Type, Globe, Image, Euro, Plus, Trash2, GripVertical, Copy, ExternalLink, Check, HelpCircle, X } from "lucide-react";
import { Link } from "react-router-dom";

const StudioSettings = () => {
  const { studio, studioId, isStudioOwner, isStudioAdmin, refetch } = useStudio();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [copied, setCopied] = useState(false);

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


  // Design - Hero
  const [heroTitleLine1, setHeroTitleLine1] = useState("");
  const [heroTitleLine2, setHeroTitleLine2] = useState("");
  const [heroSubtitle, setHeroSubtitle] = useState("");
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  // Design - Sections
  const [showPricing, setShowPricing] = useState(true);
  const [showInstrumentals, setShowInstrumentals] = useState(true);
  const [showGallery, setShowGallery] = useState(true);
  const [showGear, setShowGear] = useState(true);
  const [showBooking, setShowBooking] = useState(true);

  // Design - Typography
  const [fontFamily, setFontFamily] = useState("Inter");

  // Design - Social
  const [socialInstagram, setSocialInstagram] = useState("");
  const [socialFacebook, setSocialFacebook] = useState("");
  const [socialTiktok, setSocialTiktok] = useState("");
  const [socialYoutube, setSocialYoutube] = useState("");
  const [socialSpotify, setSocialSpotify] = useState("");
  const [socialWebsite, setSocialWebsite] = useState("");

  // Design - Footer
  const [footerText, setFooterText] = useState("");
  const [navbarStyle, setNavbarStyle] = useState("transparent");

  // Design - Advanced
  const [heroTitleSize, setHeroTitleSize] = useState("9xl");
  const [heroSubtitleSize, setHeroSubtitleSize] = useState("xl");
  const [bodyTextSize, setBodyTextSize] = useState("base");
  const [sectionTitleSize, setSectionTitleSize] = useState("3xl");
  const [buttonStyle, setButtonStyle] = useState("rounded");
  const [buttonSize, setButtonSize] = useState("xl");
  const [buttonLayout, setButtonLayout] = useState("row");
  const [heroLayout, setHeroLayout] = useState("center");
  const [showHeroStats, setShowHeroStats] = useState("true");

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
      // Design fields
      setHeroTitleLine1((studio as any).hero_title_line1 || "");
      setHeroTitleLine2((studio as any).hero_title_line2 || "");
      setHeroSubtitle((studio as any).hero_subtitle || "");
      setHeroImageUrl((studio as any).hero_image_url || "");
      setLogoUrl((studio as any).logo_url || "");
      setShowPricing((studio as any).show_pricing ?? true);
      setShowInstrumentals((studio as any).show_instrumentals ?? true);
      setShowGallery((studio as any).show_gallery ?? true);
      setShowGear((studio as any).show_gear ?? true);
      setShowBooking((studio as any).show_booking ?? true);
      setFontFamily((studio as any).font_family || "Inter");
      setNavbarStyle((studio as any).navbar_style || "transparent");
      setSocialInstagram((studio as any).social_instagram || "");
      setSocialFacebook((studio as any).social_facebook || "");
      setSocialTiktok((studio as any).social_tiktok || "");
      setSocialYoutube((studio as any).social_youtube || "");
      setSocialSpotify((studio as any).social_spotify || "");
      setSocialWebsite((studio as any).social_website || "");
      setFooterText((studio as any).footer_text || "");
      // Advanced design
      setHeroTitleSize((studio as any).hero_title_size || "9xl");
      setHeroSubtitleSize((studio as any).hero_subtitle_size || "xl");
      setBodyTextSize((studio as any).body_text_size || "base");
      setSectionTitleSize((studio as any).section_title_size || "3xl");
      setButtonStyle((studio as any).button_style || "rounded");
      setButtonSize((studio as any).button_size || "xl");
      setButtonLayout((studio as any).button_layout || "row");
      setHeroLayout((studio as any).hero_layout || "center");
      setShowHeroStats((studio as any).show_hero_stats ?? "true");
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
      } else if (activeTab === "design") {
        Object.assign(updateData, {
          hero_title_line1: heroTitleLine1 || null,
          hero_title_line2: heroTitleLine2 || null,
          hero_subtitle: heroSubtitle || null,
          hero_image_url: heroImageUrl || null,
          logo_url: logoUrl || null,
          show_pricing: showPricing,
          show_instrumentals: showInstrumentals,
          show_gallery: showGallery,
          show_gear: showGear,
          show_booking: showBooking,
          font_family: fontFamily,
          navbar_style: navbarStyle,
          social_instagram: socialInstagram || null,
          social_facebook: socialFacebook || null,
          social_tiktok: socialTiktok || null,
          social_youtube: socialYoutube || null,
          social_spotify: socialSpotify || null,
          social_website: socialWebsite || null,
          footer_text: footerText || null,
          hero_title_size: heroTitleSize,
          hero_subtitle_size: heroSubtitleSize,
          body_text_size: bodyTextSize,
          section_title_size: sectionTitleSize,
          button_style: buttonStyle,
          button_size: buttonSize,
          button_layout: buttonLayout,
          hero_layout: heroLayout,
          show_hero_stats: showHeroStats,
        });
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

  // --- Pricing / Services state ---
  interface ServiceItem { id: string; service_key: string; name_fr: string; base_price: number; price_unit: string; is_active: boolean; sort_order: number; }
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceKey, setNewServiceKey] = useState("");
  const [newServicePrice, setNewServicePrice] = useState(0);
  const [newServiceUnit, setNewServiceUnit] = useState("/h");

  const loadServices = async () => {
    setServicesLoading(true);
    const { data } = await supabase.from("services").select("*").order("sort_order");
    if (data) setServices(data as any);
    setServicesLoading(false);
  };

  useEffect(() => { if (activeTab === "pricing") loadServices(); }, [activeTab]);

  const updateServiceField = async (id: string, field: string, value: any) => {
    const { error } = await supabase.from("services").update({ [field]: value }).eq("id", id);
    if (!error) setServices(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    else toast({ title: "Erreur", description: error.message, variant: "destructive" });
  };

  const addService = async () => {
    if (!newServiceName || !newServiceKey) return toast({ title: "Remplissez le nom et la clé", variant: "destructive" });
    const { data, error } = await supabase.from("services").insert({
      service_key: newServiceKey.toLowerCase().replace(/\s+/g, "-"),
      name_fr: newServiceName,
      base_price: newServicePrice,
      price_unit: newServiceUnit,
      is_active: true,
      sort_order: services.length + 1,
    }).select().single();
    if (error) return toast({ title: "Erreur", description: error.message, variant: "destructive" });
    if (data) setServices(prev => [...prev, data as any]);
    setNewServiceName(""); setNewServiceKey(""); setNewServicePrice(0);
    toast({ title: "✅ Service ajouté !" });
  };

  const deleteService = async (id: string) => {
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (!error) setServices(prev => prev.filter(s => s.id !== id));
    else toast({ title: "Erreur", description: error.message, variant: "destructive" });
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
    { id: "pricing", label: "Tarifs", icon: Euro },
    { id: "design", label: "Design", icon: Layout },
    { id: "branding", label: "Couleurs", icon: Palette },
    { id: "payment", label: "Paiements", icon: CreditCard },
    { id: "google", label: "Google", icon: Calendar },
    { id: "email", label: "Emails", icon: Mail },
  ];

  const SectionToggle = ({ label, description, enabled, onChange }: { label: string; description: string; enabled: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50 border border-gray-700/50">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${
          enabled ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30"
        }`}
      >
        {enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        {enabled ? "Visible" : "Masqué"}
      </button>
    </div>
  );

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

  const InfoBubble = ({ children }: { children: React.ReactNode }) => {
    const [open, setOpen] = useState(false);
    return (
      <div className="relative inline-block">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="text-gray-500 hover:text-cyan-400 transition focus:outline-none"
          title="Aide"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute left-6 top-0 z-50 w-80 max-h-[70vh] overflow-y-auto bg-gray-800 border border-cyan-500/30 rounded-xl shadow-2xl shadow-cyan-500/10 p-4 text-sm text-gray-200 animate-in fade-in slide-in-from-left-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute top-2 right-2 text-gray-500 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
              {children}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link to={`/${studio?.slug}`} className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Paramètres du studio</h1>
            <p className="text-gray-400 text-sm">{studio?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
const studioUrl = `https://www.studiobooking.art/${studio?.slug}`;
                navigator.clipboard.writeText(studioUrl);
                setCopied(true);
                toast({ title: "✅ Lien copié !", description: studioUrl });
                setTimeout(() => setCopied(false), 2000);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 hover:border-cyan-500/50 hover:bg-gray-700 text-sm text-gray-300 hover:text-white transition"
              title="Copier le lien du studio"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copié !" : "Copier le lien"}
            </button>
            <a
              href={`/${studio?.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-sm text-cyan-400 hover:text-cyan-300 transition"
              title="Voir la page du studio"
            >
              <ExternalLink className="w-4 h-4" />
              Voir le studio
            </a>
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
<span className="px-3 text-gray-500 text-sm">studiobooking.art/</span>
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

          {activeTab === "pricing" && (
            <>
              <h3 className="text-lg font-bold text-cyan-400 flex items-center gap-2 mb-2">
                <Euro className="w-5 h-5" /> Vos services & tarifs
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                Ajoutez, modifiez ou supprimez les services proposés par votre studio. Les prix s'affichent sur votre page et dans le système de réservation.
              </p>

              {servicesLoading ? (
                <p className="text-gray-500 text-center py-8">Chargement...</p>
              ) : (
                <div className="space-y-3">
                  {services.map((service) => (
                    <div key={service.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 border border-gray-700/50">
                      <GripVertical className="w-4 h-4 text-gray-600 shrink-0" />
                      <div className="flex-1 grid grid-cols-12 gap-2 items-center">
                        {/* Name */}
                        <input
                          value={service.name_fr}
                          onChange={(e) => setServices(prev => prev.map(s => s.id === service.id ? { ...s, name_fr: e.target.value } : s))}
                          onBlur={() => updateServiceField(service.id, "name_fr", service.name_fr)}
                          className="col-span-4 bg-gray-700/50 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
                          placeholder="Nom du service"
                        />
                        {/* Key */}
                        <input
                          value={service.service_key}
                          onChange={(e) => setServices(prev => prev.map(s => s.id === service.id ? { ...s, service_key: e.target.value } : s))}
                          onBlur={() => updateServiceField(service.id, "service_key", service.service_key)}
                          className="col-span-3 bg-gray-700/50 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-300 font-mono focus:border-cyan-500 focus:outline-none"
                          placeholder="cle-service"
                        />
                        {/* Price */}
                        <div className="col-span-2 flex items-center gap-1">
                          <input
                            type="number"
                            value={service.base_price}
                            onChange={(e) => setServices(prev => prev.map(s => s.id === service.id ? { ...s, base_price: Number(e.target.value) } : s))}
                            onBlur={() => updateServiceField(service.id, "base_price", service.base_price)}
                            className="w-full bg-gray-700/50 border border-gray-600 rounded px-2 py-1.5 text-sm text-white text-right focus:border-cyan-500 focus:outline-none"
                          />
                          <span className="text-xs text-gray-400 shrink-0">€</span>
                        </div>
                        {/* Unit */}
                        <select
                          value={service.price_unit}
                          onChange={(e) => updateServiceField(service.id, "price_unit", e.target.value)}
                          className="col-span-1 bg-gray-700/50 border border-gray-600 rounded px-1 py-1.5 text-xs text-gray-300 focus:border-cyan-500 focus:outline-none"
                        >
                          <option value="/h">/h</option>
                          <option value="/session">/sess</option>
                          <option value="/track">/piste</option>
                          <option value="/projet">/proj</option>
                          <option value="">(fixe)</option>
                        </select>
                        {/* Active toggle */}
                        <button
                          onClick={() => updateServiceField(service.id, "is_active", !service.is_active)}
                          className={`col-span-1 px-2 py-1.5 rounded text-xs font-medium transition ${
                            service.is_active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {service.is_active ? "ON" : "OFF"}
                        </button>
                      </div>
                      {/* Delete */}
                      <button
                        onClick={() => { if (confirm(`Supprimer "${service.name_fr}" ?`)) deleteService(service.id); }}
                        className="text-red-400/60 hover:text-red-400 transition shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new service */}
              <div className="mt-6 p-4 rounded-xl border-2 border-dashed border-gray-700 space-y-3">
                <h4 className="text-sm font-bold text-gray-300 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-cyan-400" /> Ajouter un service
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={newServiceName}
                    onChange={(e) => { setNewServiceName(e.target.value); setNewServiceKey(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")); }}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                    placeholder="Nom (ex: Mixage audio)"
                  />
                  <input
                    value={newServiceKey}
                    onChange={(e) => setNewServiceKey(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 font-mono focus:border-cyan-500 focus:outline-none"
                    placeholder="Clé (ex: mixage-audio)"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={newServicePrice}
                      onChange={(e) => setNewServicePrice(Number(e.target.value))}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                      placeholder="Prix"
                    />
                    <span className="text-gray-400 text-sm">€</span>
                  </div>
                  <select
                    value={newServiceUnit}
                    onChange={(e) => setNewServiceUnit(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="/h">Par heure</option>
                    <option value="/session">Par session</option>
                    <option value="/track">Par piste</option>
                    <option value="/projet">Par projet</option>
                    <option value="">Prix fixe</option>
                  </select>
                  <button
                    onClick={addService}
                    className="flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-600 hover:to-violet-600 text-white font-bold py-2 px-4 rounded-lg transition text-sm"
                  >
                    <Plus className="w-4 h-4" /> Ajouter
                  </button>
                </div>
              </div>

              {/* Summary */}
              {services.length > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-gray-800/30 border border-gray-700/30">
                  <p className="text-xs text-gray-400">
                    📊 {services.filter(s => s.is_active).length} service(s) actif(s) sur {services.length} total
                  </p>
                </div>
              )}
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

              {/* STRIPE */}
              <div className="border-b border-gray-800 pb-4 mb-4">
                <h3 className="font-semibold text-cyan-400 mb-3">Stripe</h3>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="block text-sm font-medium text-gray-300">Clé publique (pk_...)</label>
                    <InfoBubble>
                      <p className="font-semibold mb-1">💳 Clé publique Stripe</p>
                      <ol className="list-decimal list-inside space-y-1 text-xs">
                        <li>Connectez-vous sur <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">Stripe Dashboard → API Keys</a></li>
                        <li>Copiez la <strong>"Publishable key"</strong> (commence par <code className="bg-gray-900 px-1 rounded">pk_live_</code> ou <code className="bg-gray-900 px-1 rounded">pk_test_</code>)</li>
                      </ol>
                      <p className="text-xs mt-2 text-gray-400">💡 Utilisez les clés <code className="bg-gray-900 px-1 rounded">pk_test_</code> pour tester, puis passez en <code className="bg-gray-900 px-1 rounded">pk_live_</code> pour la production.</p>
                    </InfoBubble>
                  </div>
                  <input type="text" value={stripePublishableKey} onChange={(e: any) => setStripePublishableKey(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none text-sm" placeholder="pk_live_..." />
                </div>

                <div className="mt-3">
                  <div className="flex items-center gap-2 mb-1">
                    <label className="block text-sm font-medium text-gray-300">Clé secrète (sk_...)</label>
                    <InfoBubble>
                      <p className="font-semibold mb-1">🔒 Clé secrète Stripe</p>
                      <ol className="list-decimal list-inside space-y-1 text-xs">
                        <li>Sur le même <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">Stripe Dashboard → API Keys</a></li>
                        <li>Cliquez sur <strong>"Reveal live key"</strong> (ou test key)</li>
                        <li>Copiez la <strong>"Secret key"</strong> (commence par <code className="bg-gray-900 px-1 rounded">sk_live_</code> ou <code className="bg-gray-900 px-1 rounded">sk_test_</code>)</li>
                      </ol>
                      <div className="mt-2 pt-2 border-t border-gray-700">
                        <p className="text-xs font-semibold text-amber-400">⚠️ Ne partagez jamais cette clé publiquement ! Elle permet de gérer les paiements sur votre compte.</p>
                      </div>
                    </InfoBubble>
                  </div>
                  <input type="password" value={stripeSecretKey} onChange={(e: any) => setStripeSecretKey(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none text-sm" placeholder="sk_live_..." />
                </div>
              </div>

              {/* PAYPAL */}
              <div>
                <h3 className="font-semibold text-cyan-400 mb-3">PayPal</h3>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="block text-sm font-medium text-gray-300">Client ID</label>
                    <InfoBubble>
                      <p className="font-semibold mb-1">🅿️ PayPal Client ID</p>
                      <ol className="list-decimal list-inside space-y-1 text-xs">
                        <li>Connectez-vous sur <a href="https://developer.paypal.com/dashboard/applications/live" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">PayPal Developer → Applications</a></li>
                        <li>Cliquez sur votre application (ou créez-en une : <strong>"Create App"</strong>)</li>
                        <li>Copiez le <strong>"Client ID"</strong> affiché</li>
                      </ol>
                      <p className="text-xs mt-2 text-gray-400">💡 Basculez entre <strong>"Sandbox"</strong> (test) et <strong>"Live"</strong> (production) en haut de la page.</p>
                    </InfoBubble>
                  </div>
                  <input type="text" value={paypalClientId} onChange={(e: any) => setPaypalClientId(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none text-sm" placeholder="AX..." />
                </div>

                <div className="mt-3">
                  <div className="flex items-center gap-2 mb-1">
                    <label className="block text-sm font-medium text-gray-300">Client Secret</label>
                    <InfoBubble>
                      <p className="font-semibold mb-1">🔐 PayPal Client Secret</p>
                      <ol className="list-decimal list-inside space-y-1 text-xs">
                        <li>Sur la même page <a href="https://developer.paypal.com/dashboard/applications/live" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">PayPal Developer → votre app</a></li>
                        <li>Cliquez sur <strong>"Show"</strong> à côté de <strong>"Secret"</strong></li>
                        <li>Copiez la clé secrète</li>
                      </ol>
                      <div className="mt-2 pt-2 border-t border-gray-700">
                        <p className="text-xs font-semibold text-amber-400">⚠️ Gardez cette clé confidentielle. Elle donne accès à votre compte PayPal.</p>
                      </div>
                    </InfoBubble>
                  </div>
                  <input type="password" value={paypalClientSecret} onChange={(e: any) => setPaypalClientSecret(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none text-sm" placeholder="EK..." />
                </div>
              </div>
            </>
          )}

          {activeTab === "google" && (
            <>
              <p className="text-sm text-gray-400 mb-4">
                📅 Connectez votre Google Calendar et Google Drive pour synchroniser les réservations et stocker les fichiers clients.
              </p>

              {/* Google Calendar ID (principal) */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="block text-sm font-medium text-gray-300">Google Calendar ID (principal)</label>
                  <InfoBubble>
                    <p className="font-semibold mb-1">📅 Comment trouver votre Calendar ID ?</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li>Allez sur <a href="https://calendar.google.com/calendar/r/settings" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">Google Calendar → Paramètres</a></li>
                      <li>Cliquez sur le calendrier souhaité dans la colonne gauche</li>
                      <li>Descendez jusqu'à <strong>"Intégrer l'agenda"</strong></li>
                      <li>Copiez l'<strong>ID de l'agenda</strong> (format : <code className="bg-gray-900 px-1 rounded">xxx@group.calendar.google.com</code>)</li>
                    </ol>
                    <p className="text-xs mt-2 text-gray-400">💡 Ce calendrier sera utilisé pour afficher les créneaux disponibles et créer les événements de session.</p>
                  </InfoBubble>
                </div>
                <input
                  type="text"
                  value={googleCalendarId}
                  onChange={(e: any) => setGoogleCalendarId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none text-sm"
                  placeholder="xxx@group.calendar.google.com"
                />
              </div>

              {/* Google Calendar ID (patron) */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="block text-sm font-medium text-gray-300">Google Calendar ID (patron)</label>
                  <InfoBubble>
                    <p className="font-semibold mb-1">👤 Calendar ID du patron / propriétaire</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li>Allez sur <a href="https://calendar.google.com/calendar/r/settings" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">Google Calendar → Paramètres</a></li>
                      <li>Sélectionnez le calendrier <strong>personnel</strong> du patron</li>
                      <li>Copiez l'<strong>ID de l'agenda</strong></li>
                    </ol>
                    <p className="text-xs mt-2 text-gray-400">💡 Optionnel — Permet d'ajouter aussi les sessions au calendrier personnel du gérant. Laissez vide si non nécessaire.</p>
                  </InfoBubble>
                </div>
                <input
                  type="text"
                  value={googlePatronCalendarId}
                  onChange={(e: any) => setGooglePatronCalendarId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none text-sm"
                  placeholder="xxx@group.calendar.google.com"
                />
              </div>

              {/* Google Drive Parent Folder ID */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="block text-sm font-medium text-gray-300">Google Drive Parent Folder ID</label>
                  <InfoBubble>
                    <p className="font-semibold mb-1">📁 Comment trouver l'ID du dossier Drive ?</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li>Allez sur <a href="https://drive.google.com/drive/my-drive" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">Google Drive</a></li>
                      <li>Créez ou ouvrez le <strong>dossier parent</strong> qui contiendra les dossiers de vos clients</li>
                      <li>L'ID est dans l'URL : <code className="bg-gray-900 px-1 rounded text-xs">drive.google.com/drive/folders/<strong className="text-cyan-400">1ABC...XYZ</strong></code></li>
                      <li>Copiez cette partie de l'URL (la longue chaîne après <code>/folders/</code>)</li>
                    </ol>
                    <p className="text-xs mt-2 text-gray-400">💡 Chaque nouveau client aura automatiquement un sous-dossier créé dans ce dossier parent.</p>
                  </InfoBubble>
                </div>
                <input
                  type="text"
                  value={googleDriveFolderId}
                  onChange={(e: any) => setGoogleDriveFolderId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none text-sm"
                  placeholder="1ABC..."
                />
              </div>

              {/* Clé Service Account (JSON) */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="block text-sm font-medium text-gray-300">Clé Service Account (JSON)</label>
                  <InfoBubble>
                    <p className="font-semibold mb-1">🔑 Comment obtenir la clé Service Account ?</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li>Allez sur <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">Google Cloud Console → Service Accounts</a></li>
                      <li>Créez un projet ou sélectionnez votre projet existant</li>
                      <li>Cliquez sur <strong>"Créer un compte de service"</strong></li>
                      <li>Donnez-lui un nom (ex: <em>studio-booking</em>)</li>
                      <li>Allez dans l'onglet <strong>"Clés"</strong> → <strong>"Ajouter une clé"</strong> → <strong>"JSON"</strong></li>
                      <li>Un fichier <code className="bg-gray-900 px-1 rounded">.json</code> sera téléchargé — <strong>collez son contenu ici</strong></li>
                    </ol>
                    <div className="mt-2 pt-2 border-t border-gray-700">
                      <p className="text-xs font-semibold text-amber-400 mb-1">⚠️ APIs à activer :</p>
                      <ul className="text-xs space-y-1">
                        <li>• <a href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">Google Calendar API</a></li>
                        <li>• <a href="https://console.cloud.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">Google Drive API</a></li>
                      </ul>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-700">
                      <p className="text-xs text-gray-400">💡 Partagez aussi votre calendrier et dossier Drive avec l'email du compte de service (visible dans le JSON sous <code className="bg-gray-900 px-1 rounded">client_email</code>).</p>
                    </div>
                  </InfoBubble>
                </div>
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

              {/* Resend API Key */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="block text-sm font-medium text-gray-300">Resend API Key</label>
                  <InfoBubble>
                    <p className="font-semibold mb-1">📧 Comment obtenir une clé API Resend ?</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li>Créez un compte sur <a href="https://resend.com/signup" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">resend.com</a></li>
                      <li>Allez dans <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">API Keys</a></li>
                      <li>Cliquez sur <strong>"Create API Key"</strong></li>
                      <li>Donnez un nom (ex: <em>studio-emails</em>) et copiez la clé (commence par <code className="bg-gray-900 px-1 rounded">re_</code>)</li>
                    </ol>
                    <div className="mt-2 pt-2 border-t border-gray-700">
                      <p className="text-xs font-semibold text-amber-400 mb-1">⚠️ Configuration du domaine requise :</p>
                      <p className="text-xs text-gray-400">Pour envoyer des emails depuis votre propre domaine, ajoutez-le dans <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">Resend → Domains</a> et configurez les enregistrements DNS (SPF, DKIM, DMARC).</p>
                    </div>
                    <p className="text-xs mt-2 text-gray-400">💡 Le plan gratuit Resend permet d'envoyer jusqu'à 3 000 emails/mois.</p>
                  </InfoBubble>
                </div>
                <input type="password" value={resendApiKey} onChange={(e: any) => setResendApiKey(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none text-sm" placeholder="re_..." />
              </div>

              {/* Email expéditeur */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="block text-sm font-medium text-gray-300">Email expéditeur</label>
                  <InfoBubble>
                    <p className="font-semibold mb-1">📬 Email d'expédition</p>
                    <p className="text-xs mb-2">C'est l'adresse qui apparaîtra comme expéditeur dans les emails reçus par vos clients.</p>
                    <ul className="text-xs space-y-1">
                      <li>• <strong>Avec domaine vérifié :</strong> <code className="bg-gray-900 px-1 rounded">noreply@votre-domaine.com</code></li>
                      <li>• <strong>Sans domaine :</strong> <code className="bg-gray-900 px-1 rounded">onboarding@resend.dev</code> (par défaut, pour tester)</li>
                    </ul>
                    <div className="mt-2 pt-2 border-t border-gray-700">
                      <p className="text-xs text-gray-400">💡 Pour une meilleure délivrabilité, vérifiez votre domaine dans <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">Resend → Domains</a> et utilisez une adresse de ce domaine.</p>
                    </div>
                  </InfoBubble>
                </div>
                <input type="email" value={resendFromEmail} onChange={(e: any) => setResendFromEmail(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none text-sm" placeholder="noreply@votre-domaine.com" />
              </div>
            </>
          )}

          {activeTab === "design" && (
            <>
              {/* VISUAL EDITOR LINK */}
              <Link to={`/${studio?.slug}/visual-editor`}
                className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-violet-500/10 border border-cyan-500/30 hover:border-cyan-400/50 transition mb-4 group">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 flex items-center justify-center text-lg">🎨</div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white group-hover:text-cyan-300 transition">Éditeur Visuel</p>
                  <p className="text-xs text-gray-400">Personnalisez votre page avec un aperçu en temps réel</p>
                </div>
                <span className="text-cyan-400 text-lg">→</span>
              </Link>

              {/* HERO */}
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-cyan-400 flex items-center gap-2">
                  <Image className="w-5 h-5" /> Hero (Bannière principale)
                </h3>
                <p className="text-xs text-gray-400">Personnalisez le titre et le sous-titre affichés en grand sur votre page.</p>
                <InputField label="Titre ligne 1 (ex: STUDIO)" value={heroTitleLine1} onChange={setHeroTitleLine1} placeholder="Laissez vide = auto depuis le nom" />
                <InputField label="Titre ligne 2 (ex: MAKE MUSIC)" value={heroTitleLine2} onChange={setHeroTitleLine2} placeholder="Laissez vide = auto depuis le nom" />
                <InputField label="Sous-titre / description courte" value={heroSubtitle} onChange={setHeroSubtitle} placeholder="Un espace créatif équipé des meilleures technologies..." />
                <InputField label="Image de fond (URL)" value={heroImageUrl} onChange={setHeroImageUrl} placeholder="https://..." />
                <InputField label="Logo (URL)" value={logoUrl} onChange={setLogoUrl} placeholder="https://..." />
              </div>

              <hr className="border-gray-700 my-6" />

              {/* SECTIONS */}
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-cyan-400 flex items-center gap-2">
                  <Eye className="w-5 h-5" /> Sections visibles
                </h3>
                <p className="text-xs text-gray-400">Choisissez quelles sections afficher sur votre page studio.</p>
                <SectionToggle label="📋 Tarifs / Offres" description="Section des prix et formules" enabled={showPricing} onChange={setShowPricing} />
                <SectionToggle label="🎵 Instrumentales" description="Catalogue de beats à vendre" enabled={showInstrumentals} onChange={setShowInstrumentals} />
                <SectionToggle label="🖼️ Galerie" description="Photos/vidéos du studio" enabled={showGallery} onChange={setShowGallery} />
                <SectionToggle label="🎧 Équipement" description="Liste du matériel du studio" enabled={showGear} onChange={setShowGear} />
                <SectionToggle label="📅 Réservation" description="Calendrier de réservation" enabled={showBooking} onChange={setShowBooking} />
              </div>

              <hr className="border-gray-700 my-6" />

              {/* TYPOGRAPHY */}
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-cyan-400 flex items-center gap-2">
                  <Type className="w-5 h-5" /> Typographie
                </h3>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Police d'écriture</label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none text-sm"
                  >
                    <option value="Inter">Inter (Moderne)</option>
                    <option value="Space Grotesk">Space Grotesk (Tech)</option>
                    <option value="Poppins">Poppins (Arrondi)</option>
                    <option value="Montserrat">Montserrat (Élégant)</option>
                    <option value="Roboto">Roboto (Google)</option>
                    <option value="Oswald">Oswald (Impact)</option>
                    <option value="Playfair Display">Playfair Display (Serif)</option>
                  </select>
                </div>
                <div className="p-4 rounded-xl bg-gray-800/50 border border-gray-700/50">
                  <p className="text-gray-400 text-xs mb-1">Aperçu :</p>
                  <p style={{ fontFamily }} className="text-2xl font-bold text-white">{name || "Mon Studio"}</p>
                  <p style={{ fontFamily }} className="text-sm text-gray-300">Bienvenue dans notre espace créatif</p>
                </div>
              </div>

              <hr className="border-gray-700 my-6" />

              {/* TEXT SIZES */}
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-cyan-400 flex items-center gap-2">📏 Tailles des textes</h3>
                <p className="text-xs text-gray-400">Ajustez la taille des différents éléments textuels.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Titre Hero</label>
                    <select value={heroTitleSize} onChange={(e) => setHeroTitleSize(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none text-sm">
                      <option value="5xl">Petit (5xl)</option>
                      <option value="6xl">Moyen (6xl)</option>
                      <option value="7xl">Grand (7xl)</option>
                      <option value="8xl">Très grand (8xl)</option>
                      <option value="9xl">Énorme (9xl)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Sous-titre Hero</label>
                    <select value={heroSubtitleSize} onChange={(e) => setHeroSubtitleSize(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none text-sm">
                      <option value="sm">Petit (sm)</option>
                      <option value="base">Normal (base)</option>
                      <option value="lg">Moyen (lg)</option>
                      <option value="xl">Grand (xl)</option>
                      <option value="2xl">Très grand (2xl)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Titres de section</label>
                    <select value={sectionTitleSize} onChange={(e) => setSectionTitleSize(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none text-sm">
                      <option value="xl">Petit (xl)</option>
                      <option value="2xl">Moyen (2xl)</option>
                      <option value="3xl">Grand (3xl)</option>
                      <option value="4xl">Très grand (4xl)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Texte courant</label>
                    <select value={bodyTextSize} onChange={(e) => setBodyTextSize(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none text-sm">
                      <option value="sm">Petit (sm)</option>
                      <option value="base">Normal (base)</option>
                      <option value="lg">Grand (lg)</option>
                      <option value="xl">Très grand (xl)</option>
                    </select>
                  </div>
                </div>
              </div>

              <hr className="border-gray-700 my-6" />

              {/* BUTTON STYLE */}
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-cyan-400 flex items-center gap-2">🔘 Style des boutons</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Forme</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: "rounded", label: "Arrondi", preview: "rounded-lg" },
                      { id: "pill", label: "Pilule", preview: "rounded-full" },
                      { id: "square", label: "Carré", preview: "rounded-none" },
                    ].map((s) => (
                      <button key={s.id} onClick={() => setButtonStyle(s.id)}
                        className={`p-3 text-center text-sm font-medium transition border ${
                          buttonStyle === s.id ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" : "bg-gray-800/50 text-gray-400 border-gray-700/50 hover:border-gray-600"
                        }`}
                        style={{ borderRadius: s.id === "rounded" ? "8px" : s.id === "pill" ? "9999px" : "0" }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Taille des boutons</label>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { id: "sm", label: "S" },
                      { id: "default", label: "M" },
                      { id: "lg", label: "L" },
                      { id: "xl", label: "XL" },
                    ].map((s) => (
                      <button key={s.id} onClick={() => setButtonSize(s.id)}
                        className={`p-2 text-center text-sm font-medium transition border rounded-lg ${
                          buttonSize === s.id ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" : "bg-gray-800/50 text-gray-400 border-gray-700/50 hover:border-gray-600"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Disposition des boutons Hero</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: "row", label: "🔀 En ligne" },
                      { id: "column", label: "📑 Empilés" },
                      { id: "grid", label: "▦ Grille" },
                    ].map((s) => (
                      <button key={s.id} onClick={() => setButtonLayout(s.id)}
                        className={`p-3 text-center text-sm font-medium transition border rounded-lg ${
                          buttonLayout === s.id ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" : "bg-gray-800/50 text-gray-400 border-gray-700/50 hover:border-gray-600"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <hr className="border-gray-700 my-6" />

              {/* HERO LAYOUT */}
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-cyan-400 flex items-center gap-2">🎯 Layout Hero</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "center", label: "📍 Centré" },
                    { id: "left", label: "◀️ Gauche" },
                    { id: "right", label: "▶️ Droite" },
                  ].map((s) => (
                    <button key={s.id} onClick={() => setHeroLayout(s.id)}
                      className={`p-3 text-center text-sm font-medium transition border rounded-lg ${
                        heroLayout === s.id ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" : "bg-gray-800/50 text-gray-400 border-gray-700/50 hover:border-gray-600"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <SectionToggle label="📊 Statistiques prix" description="Afficher les prix et PRO dans le Hero" enabled={showHeroStats === "true"} onChange={(v) => setShowHeroStats(v ? "true" : "false")} />
              </div>

              <hr className="border-gray-700 my-6" />

              {/* NAVBAR */}
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-cyan-400">Style de la barre de navigation</h3>
                <div className="grid grid-cols-3 gap-3">
                  {(["transparent", "solid", "gradient"] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => setNavbarStyle(style)}
                      className={`p-3 rounded-lg text-center text-sm font-medium transition border ${
                        navbarStyle === style
                          ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                          : "bg-gray-800/50 text-gray-400 border-gray-700/50 hover:border-gray-600"
                      }`}
                    >
                      {style === "transparent" ? "🔍 Transparent" : style === "solid" ? "🟦 Solide" : "🌈 Dégradé"}
                    </button>
                  ))}
                </div>
              </div>

              <hr className="border-gray-700 my-6" />

              {/* SOCIAL LINKS */}
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-cyan-400 flex items-center gap-2">
                  <Globe className="w-5 h-5" /> Réseaux sociaux
                </h3>
                <p className="text-xs text-gray-400">Ajoutez vos liens pour les afficher dans le footer.</p>
                <InputField label="Instagram" value={socialInstagram} onChange={setSocialInstagram} placeholder="https://instagram.com/..." />
                <InputField label="Facebook" value={socialFacebook} onChange={setSocialFacebook} placeholder="https://facebook.com/..." />
                <InputField label="TikTok" value={socialTiktok} onChange={setSocialTiktok} placeholder="https://tiktok.com/@..." />
                <InputField label="YouTube" value={socialYoutube} onChange={setSocialYoutube} placeholder="https://youtube.com/..." />
                <InputField label="Spotify" value={socialSpotify} onChange={setSocialSpotify} placeholder="https://open.spotify.com/artist/..." />
                <InputField label="Site web" value={socialWebsite} onChange={setSocialWebsite} placeholder="https://..." />
              </div>

              <hr className="border-gray-700 my-6" />

              {/* FOOTER */}
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-cyan-400">Footer personnalisé</h3>
                <InputField label="Texte du footer (optionnel)" value={footerText} onChange={setFooterText} placeholder="© 2026 Mon Studio - Tous droits réservés" />
              </div>
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
