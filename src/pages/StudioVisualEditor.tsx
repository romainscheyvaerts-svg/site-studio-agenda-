import { useState, useEffect, useCallback } from "react";
import { useStudio } from "@/hooks/useStudio";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save, ArrowLeft, Eye, Undo2, Monitor, Smartphone, Type, Palette, Layout, MousePointer2, BarChart3, Layers } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ---- Live Preview Component ----
const HeroPreview = ({ config }: { config: any }) => {
  const titleSizeMap: Record<string, string> = {
    "5xl": "text-2xl", "6xl": "text-3xl", "7xl": "text-4xl", "8xl": "text-5xl", "9xl": "text-6xl",
  };
  const subtitleSizeMap: Record<string, string> = {
    sm: "text-xs", base: "text-sm", lg: "text-base", xl: "text-lg", "2xl": "text-xl",
  };
  const btnRounded = config.buttonStyle === "pill" ? "rounded-full" : config.buttonStyle === "square" ? "rounded-none" : "rounded-lg";
  const btnPadding = config.buttonSize === "sm" ? "px-3 py-1 text-xs" : config.buttonSize === "default" ? "px-4 py-2 text-sm" : config.buttonSize === "lg" ? "px-5 py-2.5 text-sm" : "px-6 py-3 text-base";
  const layoutAlign = config.heroLayout === "left" ? "text-left items-start" : config.heroLayout === "right" ? "text-right items-end" : "text-center items-center";
  const btnLayoutCls = config.buttonLayout === "column" ? "flex-col" : config.buttonLayout === "grid" ? "flex-wrap" : "flex-row";
  const btnJustify = config.heroLayout === "center" ? "justify-center" : config.heroLayout === "left" ? "justify-start" : "justify-end";

  return (
    <div
      className={cn("relative w-full h-full flex items-center justify-center overflow-hidden")}
      style={{ background: config.backgroundColor, fontFamily: `${config.fontFamily}, sans-serif` }}
    >
      {/* BG effects */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: `linear-gradient(${config.primaryColor}22 1px, transparent 1px), linear-gradient(90deg, ${config.primaryColor}22 1px, transparent 1px)`,
        backgroundSize: "40px 40px"
      }} />
      <div className="absolute top-1/4 left-1/4 w-48 h-48 rounded-full blur-[80px] animate-pulse" style={{ background: `${config.primaryColor}30` }} />
      <div className="absolute bottom-1/4 right-1/4 w-40 h-40 rounded-full blur-[60px] animate-pulse" style={{ background: `${config.secondaryColor}20`, animationDelay: "1s" }} />

      <div className={cn("relative z-10 container mx-auto px-6 flex flex-col", layoutAlign)}>
        {/* Title */}
        <h1 className={cn("font-bold leading-none mb-4", titleSizeMap[config.heroTitleSize] || "text-6xl")} style={{ color: "#fff" }}>
          {config.heroLine1 || "STUDIO"}
          <br />
          <span style={{ color: config.primaryColor, textShadow: `0 0 30px ${config.primaryColor}60` }}>
            {config.heroLine2 || "NAME"}
          </span>
        </h1>

        {/* Subtitle */}
        <p className={cn("max-w-md leading-relaxed mb-6 opacity-70", subtitleSizeMap[config.heroSubtitleSize] || "text-lg", config.heroLayout === "center" && "mx-auto")} style={{ color: "#ccc" }}>
          {config.heroSubtitle || "A creative space equipped with the best technologies."}
        </p>

        {/* Buttons */}
        <div className={cn("flex gap-3 mb-6", btnLayoutCls, btnJustify)}>
          {config.showBooking && (
            <button className={cn(btnRounded, btnPadding, "font-bold text-black transition")} style={{ background: `linear-gradient(135deg, ${config.primaryColor}, ${config.secondaryColor})` }}>
              🎙️ BOOKING
            </button>
          )}
          {config.showPricing && (
            <button className={cn(btnRounded, btnPadding, "font-bold transition")} style={{ border: `2px solid ${config.primaryColor}`, color: config.primaryColor, background: "transparent" }}>
              € OFFRES
            </button>
          )}
          {config.showGear && (
            <button className={cn(btnRounded, btnPadding, "font-bold transition")} style={{ border: `1px solid ${config.primaryColor}50`, color: "#fff", background: "transparent" }}>
              🎧 STUDIO
            </button>
          )}
          {config.showInstrumentals && (
            <button className={cn(btnRounded, btnPadding, "font-bold transition")} style={{ border: `1px solid ${config.secondaryColor}50`, color: config.secondaryColor, background: "transparent" }}>
              🎵 BEATS
            </button>
          )}
        </div>

        {/* Stats */}
        {config.showHeroStats && (
          <div className="flex gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold" style={{ color: config.primaryColor, textShadow: `0 0 15px ${config.primaryColor}40` }}>45€</div>
              <div className="text-xs opacity-50" style={{ color: "#aaa" }}>/h + eng.</div>
            </div>
            <div className="text-center border-x px-6" style={{ borderColor: "#333" }}>
              <div className="text-3xl font-bold" style={{ color: config.secondaryColor }}>22€</div>
              <div className="text-xs opacity-50" style={{ color: "#aaa" }}>/h dry</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold" style={{ color: "#fff" }}>PRO</div>
              <div className="text-xs opacity-50" style={{ color: "#aaa" }}>Studio quality</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ---- Main Visual Editor ----
const StudioVisualEditor = () => {
  const { studio, studioId, isStudioAdmin, refetch } = useStudio();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [activePanel, setActivePanel] = useState("layout");

  const s = studio as any;

  // All design config in one state
  const [config, setConfig] = useState({
    heroLine1: "", heroLine2: "", heroSubtitle: "", heroImageUrl: "", logoUrl: "",
    primaryColor: "#06b6d4", secondaryColor: "#8b5cf6", backgroundColor: "#000000",
    fontFamily: "Inter", navbarStyle: "transparent",
    heroTitleSize: "9xl", heroSubtitleSize: "xl", bodyTextSize: "base", sectionTitleSize: "3xl",
    buttonStyle: "rounded", buttonSize: "xl", buttonLayout: "row",
    heroLayout: "center", showHeroStats: true,
    showPricing: true, showInstrumentals: true, showGallery: true, showGear: true, showBooking: true, showChatbot: true,
  });

  // Original config for undo
  const [originalConfig, setOriginalConfig] = useState(config);

  useEffect(() => {
    if (studio) {
      const studioName = studio.name?.toUpperCase() || "";
      const nameWords = studioName.split(" ");
      const newConfig = {
        heroLine1: s?.hero_title_line1?.toUpperCase() || (nameWords.length > 1 ? nameWords[0] : studioName),
        heroLine2: s?.hero_title_line2?.toUpperCase() || (nameWords.length > 1 ? nameWords.slice(1).join(" ") : ""),
        heroSubtitle: s?.hero_subtitle || "",
        heroImageUrl: s?.hero_image_url || "",
        logoUrl: s?.logo_url || "",
        primaryColor: studio.primary_color || "#06b6d4",
        secondaryColor: studio.secondary_color || "#8b5cf6",
        backgroundColor: studio.background_color || "#000000",
        fontFamily: s?.font_family || "Inter",
        navbarStyle: s?.navbar_style || "transparent",
        heroTitleSize: s?.hero_title_size || "9xl",
        heroSubtitleSize: s?.hero_subtitle_size || "xl",
        bodyTextSize: s?.body_text_size || "base",
        sectionTitleSize: s?.section_title_size || "3xl",
        buttonStyle: s?.button_style || "rounded",
        buttonSize: s?.button_size || "xl",
        buttonLayout: s?.button_layout || "row",
        heroLayout: s?.hero_layout || "center",
        showHeroStats: s?.show_hero_stats !== "false",
        showPricing: s?.show_pricing ?? true,
        showInstrumentals: s?.show_instrumentals ?? true,
        showGallery: s?.show_gallery ?? true,
        showGear: s?.show_gear ?? true,
        showBooking: s?.show_booking ?? true,
        showChatbot: s?.show_chatbot ?? true,
      };
      setConfig(newConfig);
      setOriginalConfig(newConfig);
    }
  }, [studio]);

  const updateConfig = useCallback((key: string, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleUndo = () => setConfig(originalConfig);

  const handleSave = async () => {
    if (!studioId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("studios").update({
        hero_title_line1: config.heroLine1 || null,
        hero_title_line2: config.heroLine2 || null,
        hero_subtitle: config.heroSubtitle || null,
        hero_image_url: config.heroImageUrl || null,
        logo_url: config.logoUrl || null,
        primary_color: config.primaryColor,
        secondary_color: config.secondaryColor,
        background_color: config.backgroundColor,
        font_family: config.fontFamily,
        navbar_style: config.navbarStyle,
        hero_title_size: config.heroTitleSize,
        hero_subtitle_size: config.heroSubtitleSize,
        body_text_size: config.bodyTextSize,
        section_title_size: config.sectionTitleSize,
        button_style: config.buttonStyle,
        button_size: config.buttonSize,
        button_layout: config.buttonLayout,
        hero_layout: config.heroLayout,
        show_hero_stats: config.showHeroStats ? "true" : "false",
        show_pricing: config.showPricing,
        show_instrumentals: config.showInstrumentals,
        show_gallery: config.showGallery,
        show_gear: config.showGear,
        show_booking: config.showBooking,
        show_chatbot: config.showChatbot,
      }).eq("id", studioId);
      if (error) throw error;
      setOriginalConfig(config);
      await refetch();
      toast({ title: "✅ Design sauvegardé !" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!isStudioAdmin) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center"><p className="text-gray-400">Accès admin requis.</p></div>;
  }

  const hasChanges = JSON.stringify(config) !== JSON.stringify(originalConfig);

  const panels = [
    { id: "layout", icon: Layout, label: "Layout" },
    { id: "typo", icon: Type, label: "Textes" },
    { id: "buttons", icon: MousePointer2, label: "Boutons" },
    { id: "colors", icon: Palette, label: "Couleurs" },
    { id: "sections", icon: Layers, label: "Sections" },
  ];

  const SelectField = ({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) => (
    <div className="mb-3">
      <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:border-cyan-500 focus:outline-none">
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );

  const ChoiceGrid = ({ label, value, onChange, options, cols = 3 }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[]; cols?: number }) => (
    <div className="mb-3">
      <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5 block">{label}</label>
      <div className={`grid gap-1.5`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {options.map(o => (
          <button key={o.v} onClick={() => onChange(o.v)}
            className={cn("px-2 py-1.5 text-[10px] font-medium rounded-md border transition",
              value === o.v ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/40" : "bg-gray-900 text-gray-400 border-gray-700 hover:border-gray-500"
            )}>
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );

  const Toggle = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-gray-300">{label}</span>
      <button onClick={() => onChange(!value)}
        className={cn("w-9 h-5 rounded-full transition relative", value ? "bg-cyan-500" : "bg-gray-700")}>
        <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all", value ? "left-4.5" : "left-0.5")} 
          style={{ left: value ? "18px" : "2px" }} />
      </button>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white overflow-hidden">
      {/* Top bar */}
      <div className="h-12 border-b border-gray-800 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link to={`/${studio?.slug}/settings`} className="text-gray-400 hover:text-white"><ArrowLeft className="w-4 h-4" /></Link>
          <span className="font-bold text-sm">🎨 Éditeur Visuel</span>
          <span className="text-xs text-gray-500">— {studio?.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Preview mode toggle */}
          <div className="flex bg-gray-800 rounded-lg p-0.5 mr-2">
            <button onClick={() => setPreviewMode("desktop")} className={cn("px-2 py-1 rounded text-xs", previewMode === "desktop" ? "bg-gray-600 text-white" : "text-gray-400")}>
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setPreviewMode("mobile")} className={cn("px-2 py-1 rounded text-xs", previewMode === "mobile" ? "bg-gray-600 text-white" : "text-gray-400")}>
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>
          {hasChanges && (
            <button onClick={handleUndo} className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 rounded-lg transition">
              <Undo2 className="w-3 h-3" /> Annuler
            </button>
          )}
          <button onClick={handleSave} disabled={saving || !hasChanges}
            className={cn("flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition",
              hasChanges ? "bg-gradient-to-r from-cyan-500 to-violet-500 text-white hover:opacity-90" : "bg-gray-800 text-gray-500 cursor-not-allowed"
            )}>
            <Save className="w-3.5 h-3.5" /> {saving ? "..." : "Sauvegarder"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - Panels */}
        <div className="w-64 border-r border-gray-800 flex flex-col flex-shrink-0">
          {/* Panel tabs */}
          <div className="flex border-b border-gray-800">
            {panels.map(p => (
              <button key={p.id} onClick={() => setActivePanel(p.id)}
                className={cn("flex-1 py-2.5 flex flex-col items-center gap-0.5 text-[9px] transition border-b-2",
                  activePanel === p.id ? "text-cyan-400 border-cyan-500 bg-cyan-500/5" : "text-gray-500 border-transparent hover:text-gray-300"
                )}>
                <p.icon className="w-3.5 h-3.5" />
                {p.label}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {activePanel === "layout" && (
              <>
                <ChoiceGrid label="Alignement Hero" value={config.heroLayout} onChange={v => updateConfig("heroLayout", v)}
                  options={[{ v: "left", l: "◀ Gauche" }, { v: "center", l: "● Centre" }, { v: "right", l: "▶ Droite" }]} />
                <ChoiceGrid label="Navbar" value={config.navbarStyle} onChange={v => updateConfig("navbarStyle", v)}
                  options={[{ v: "transparent", l: "Transparent" }, { v: "solid", l: "Solide" }, { v: "gradient", l: "Dégradé" }]} />
                <Toggle label="Stats prix dans le Hero" value={config.showHeroStats} onChange={v => updateConfig("showHeroStats", v)} />
                <hr className="border-gray-800 my-2" />
                <div className="mb-3">
                  <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">Titre ligne 1</label>
                  <input value={config.heroLine1} onChange={e => updateConfig("heroLine1", e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:border-cyan-500 focus:outline-none" placeholder="STUDIO" />
                </div>
                <div className="mb-3">
                  <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">Titre ligne 2</label>
                  <input value={config.heroLine2} onChange={e => updateConfig("heroLine2", e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:border-cyan-500 focus:outline-none" placeholder="NAME" />
                </div>
                <div className="mb-3">
                  <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">Sous-titre</label>
                  <textarea value={config.heroSubtitle} onChange={e => updateConfig("heroSubtitle", e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:border-cyan-500 focus:outline-none h-16 resize-none" placeholder="Description..." />
                </div>
              </>
            )}

            {activePanel === "typo" && (
              <>
                <SelectField label="Police d'écriture" value={config.fontFamily} onChange={v => updateConfig("fontFamily", v)} options={[
                  { v: "Inter", l: "Inter (Moderne)" }, { v: "Space Grotesk", l: "Space Grotesk (Tech)" },
                  { v: "Poppins", l: "Poppins (Arrondi)" }, { v: "Montserrat", l: "Montserrat (Élégant)" },
                  { v: "Roboto", l: "Roboto (Google)" }, { v: "Oswald", l: "Oswald (Impact)" },
                  { v: "Playfair Display", l: "Playfair Display (Serif)" },
                ]} />
                <ChoiceGrid label="Taille titre Hero" value={config.heroTitleSize} onChange={v => updateConfig("heroTitleSize", v)} cols={5}
                  options={[{ v: "5xl", l: "S" }, { v: "6xl", l: "M" }, { v: "7xl", l: "L" }, { v: "8xl", l: "XL" }, { v: "9xl", l: "XXL" }]} />
                <ChoiceGrid label="Taille sous-titre" value={config.heroSubtitleSize} onChange={v => updateConfig("heroSubtitleSize", v)} cols={5}
                  options={[{ v: "sm", l: "XS" }, { v: "base", l: "S" }, { v: "lg", l: "M" }, { v: "xl", l: "L" }, { v: "2xl", l: "XL" }]} />
                <ChoiceGrid label="Titres de section" value={config.sectionTitleSize} onChange={v => updateConfig("sectionTitleSize", v)} cols={4}
                  options={[{ v: "xl", l: "S" }, { v: "2xl", l: "M" }, { v: "3xl", l: "L" }, { v: "4xl", l: "XL" }]} />
                <ChoiceGrid label="Texte courant" value={config.bodyTextSize} onChange={v => updateConfig("bodyTextSize", v)} cols={4}
                  options={[{ v: "sm", l: "S" }, { v: "base", l: "M" }, { v: "lg", l: "L" }, { v: "xl", l: "XL" }]} />
              </>
            )}

            {activePanel === "buttons" && (
              <>
                <ChoiceGrid label="Forme des boutons" value={config.buttonStyle} onChange={v => updateConfig("buttonStyle", v)}
                  options={[{ v: "rounded", l: "⬜ Arrondi" }, { v: "pill", l: "💊 Pilule" }, { v: "square", l: "◻ Carré" }]} />
                <ChoiceGrid label="Taille" value={config.buttonSize} onChange={v => updateConfig("buttonSize", v)} cols={4}
                  options={[{ v: "sm", l: "S" }, { v: "default", l: "M" }, { v: "lg", l: "L" }, { v: "xl", l: "XL" }]} />
                <ChoiceGrid label="Disposition" value={config.buttonLayout} onChange={v => updateConfig("buttonLayout", v)}
                  options={[{ v: "row", l: "→ Ligne" }, { v: "column", l: "↓ Pile" }, { v: "grid", l: "⊞ Grille" }]} />
                <hr className="border-gray-800 my-2" />
                <p className="text-[10px] text-gray-500 mb-1">Aperçu bouton :</p>
                <div className="flex gap-2 mb-2">
                  <button className={cn(
                    config.buttonStyle === "pill" ? "rounded-full" : config.buttonStyle === "square" ? "rounded-none" : "rounded-lg",
                    config.buttonSize === "sm" ? "px-3 py-1 text-xs" : config.buttonSize === "default" ? "px-4 py-2 text-sm" : config.buttonSize === "lg" ? "px-5 py-2.5 text-sm" : "px-6 py-3 text-base",
                    "font-bold text-black"
                  )} style={{ background: `linear-gradient(135deg, ${config.primaryColor}, ${config.secondaryColor})` }}>
                    BOOKING
                  </button>
                  <button className={cn(
                    config.buttonStyle === "pill" ? "rounded-full" : config.buttonStyle === "square" ? "rounded-none" : "rounded-lg",
                    config.buttonSize === "sm" ? "px-3 py-1 text-xs" : config.buttonSize === "default" ? "px-4 py-2 text-sm" : config.buttonSize === "lg" ? "px-5 py-2.5 text-sm" : "px-6 py-3 text-base",
                    "font-bold"
                  )} style={{ border: `2px solid ${config.primaryColor}`, color: config.primaryColor }}>
                    OFFRES
                  </button>
                </div>
              </>
            )}

            {activePanel === "colors" && (
              <>
                <div className="mb-3">
                  <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">Couleur principale</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={config.primaryColor} onChange={e => updateConfig("primaryColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                    <input value={config.primaryColor} onChange={e => updateConfig("primaryColor", e.target.value)}
                      className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono" />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">Couleur secondaire</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={config.secondaryColor} onChange={e => updateConfig("secondaryColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                    <input value={config.secondaryColor} onChange={e => updateConfig("secondaryColor", e.target.value)}
                      className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono" />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">Fond</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={config.backgroundColor} onChange={e => updateConfig("backgroundColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                    <input value={config.backgroundColor} onChange={e => updateConfig("backgroundColor", e.target.value)}
                      className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono" />
                  </div>
                </div>
                <hr className="border-gray-800 my-2" />
                <p className="text-[10px] text-gray-500 mb-1">Aperçu palette :</p>
                <div className="flex gap-1.5">
                  <div className="flex-1 h-12 rounded-lg" style={{ background: config.primaryColor }} />
                  <div className="flex-1 h-12 rounded-lg" style={{ background: config.secondaryColor }} />
                  <div className="flex-1 h-12 rounded-lg border border-gray-700" style={{ background: config.backgroundColor }} />
                </div>
              </>
            )}

            {activePanel === "sections" && (
              <>
                <p className="text-[10px] text-gray-500 mb-2">Sections affichées sur la page :</p>
                <Toggle label="📅 Réservation / Booking" value={config.showBooking} onChange={v => updateConfig("showBooking", v)} />
                <Toggle label="📋 Tarifs / Offres" value={config.showPricing} onChange={v => updateConfig("showPricing", v)} />
                <Toggle label="🎧 Équipement" value={config.showGear} onChange={v => updateConfig("showGear", v)} />
                <Toggle label="🎵 Instrumentales" value={config.showInstrumentals} onChange={v => updateConfig("showInstrumentals", v)} />
                <Toggle label="🖼️ Galerie" value={config.showGallery} onChange={v => updateConfig("showGallery", v)} />
                <Toggle label="🤖 Chatbot IA" value={config.showChatbot} onChange={v => updateConfig("showChatbot", v)} />
              </>
            )}
          </div>
        </div>

        {/* Main preview area */}
        <div className="flex-1 flex items-center justify-center bg-gray-900/50 p-6 overflow-hidden">
          <div className={cn(
            "rounded-xl overflow-hidden shadow-2xl border border-gray-700/50 transition-all duration-300",
            previewMode === "desktop" ? "w-full max-w-5xl aspect-video" : "w-[375px] h-[667px]"
          )}>
            <HeroPreview config={config} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudioVisualEditor;
