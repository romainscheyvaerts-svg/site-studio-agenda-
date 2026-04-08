import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Music, Calendar, CreditCard, Shield, Headphones, ArrowRight, Check, LogOut, Mail, Globe } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { SUPER_ADMIN_EMAIL, PLATFORM_NAME } from "@/config/constants";

const Landing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;
  const [userStudioSlug, setUserStudioSlug] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      supabase
        .from("studio_members")
        .select("studio_id, studios(slug, subscription_status)")
        .eq("user_id", user.id)
        .limit(1)
        .single()
        .then(({ data }) => {
          const s = data as any;
          if (s?.studios?.slug && ["trialing", "active"].includes(s.studios.subscription_status)) {
            setUserStudioSlug(s.studios.slug);
          }
        });
    }
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUserStudioSlug(null);
    navigate("/");
  };

  const features = [
    { key: "agenda", icon: Calendar },
    { key: "payments", icon: CreditCard },
    { key: "instrumentals", icon: Music },
    { key: "security", icon: Shield },
    { key: "chatbot", icon: Headphones },
    { key: "emails", icon: Mail },
  ];

  const pricingFeatures = [
    t("landing.pricing_features.booking"),
    t("landing.pricing_features.stripe"),
    t("landing.pricing_features.gcal"),
    t("landing.pricing_features.gdrive"),
    t("landing.pricing_features.emails"),
    t("landing.pricing_features.chatbot"),
    t("landing.pricing_features.instrumentals"),
    t("landing.pricing_features.gallery"),
    t("landing.pricing_features.multilang"),
    t("landing.pricing_features.support"),
  ];

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white">
      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-violet-500/10" />
        <nav className="relative z-10 flex items-center justify-between p-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <Headphones className="w-8 h-8 text-cyan-400" />
            <span className="text-xl font-bold">{PLATFORM_NAME}</span>
          </div>
          <div className="flex gap-4 items-center">
            {/* Language switcher */}
            <div className="flex gap-1">
              {[
                { code: "fr", flag: "🇫🇷" },
                { code: "en", flag: "🇬🇧" },
                { code: "nl", flag: "🇳🇱" },
                { code: "es", flag: "🇪🇸" },
              ].map(({ code, flag }) => (
                <button
                  key={code}
                  onClick={() => changeLanguage(code)}
                  className={`text-sm px-1.5 py-0.5 rounded transition ${
                    i18n.language?.startsWith(code)
                      ? "bg-cyan-500/20 border border-cyan-500/50"
                      : "hover:bg-gray-800"
                  }`}
                  title={code.toUpperCase()}
                >
                  {flag}
                </button>
              ))}
            </div>
            {isSuperAdmin && (
              <Link to="/super-admin" className="px-3 py-1.5 text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/30 transition flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" /> Admin
              </Link>
            )}
            {user ? (
              <>
                <Link to={userStudioSlug ? `/${userStudioSlug}/settings` : "/register-studio"} className="px-4 py-2 text-sm bg-cyan-500 hover:bg-cyan-600 rounded-lg transition font-medium">
                  {userStudioSlug ? t("landing.my_studio") : t("landing.create_studio")}
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" /> {t("landing.logout")}
                </button>
              </>
            ) : (
              <>
                <Link to="/auth" className="px-4 py-2 text-sm text-gray-300 hover:text-white transition">
                  {t("landing.login")}
                </Link>
                <Link to="/register-studio" className="px-4 py-2 text-sm bg-cyan-500 hover:bg-cyan-600 rounded-lg transition font-medium">
                  {t("landing.create_studio")}
                </Link>
              </>
            )}
          </div>
        </nav>

        <div className="relative z-10 max-w-4xl mx-auto text-center py-24 px-6">
          <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-4 py-1.5 mb-6">
            <span className="text-cyan-400 text-sm font-medium">🎵 {t("landing.badge")}</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-cyan-200 to-violet-200 bg-clip-text text-transparent">
            {t("landing.hero_title")}
          </h1>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            {t("landing.hero_desc")} <span className="text-cyan-400 font-bold">5€/{t("landing.month")}</span>.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register-studio" className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-600 hover:to-violet-600 text-white font-bold py-4 px-8 rounded-xl text-lg transition shadow-lg shadow-cyan-500/25">
              {t("landing.cta_start")} <ArrowRight className="w-5 h-5" />
            </Link>
            <a href="#features" className="inline-flex items-center gap-2 border border-gray-700 hover:border-gray-500 text-gray-300 font-medium py-4 px-8 rounded-xl text-lg transition">
              {t("landing.cta_discover")}
            </a>
          </div>
          <p className="text-sm text-gray-500 mt-4">{t("landing.cta_trial")}</p>
        </div>
      </header>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto py-20 px-6">
        <h2 className="text-3xl font-bold text-center mb-4">{t("landing.features_title")}</h2>
        <p className="text-gray-400 text-center mb-12 max-w-xl mx-auto">
          {t("landing.features_desc")}
        </p>
        <div className="grid md:grid-cols-3 gap-8">
          {features.map(({ key, icon: Icon }, i) => (
            <Link
              key={i}
              to={`/features/${key}`}
              className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6 hover:border-cyan-500/30 hover:bg-gray-800/80 transition group cursor-pointer"
            >
              <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-cyan-500/20 transition">
                <Icon className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-cyan-400 transition">
                {t(`landing.features.${key}.title`)}
              </h3>
              <p className="text-gray-400 text-sm mb-3">{t(`landing.features.${key}.desc`)}</p>
              <span className="text-cyan-400 text-xs font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                {t("landing.learn_more")} <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-3xl mx-auto py-20 px-6 text-center">
        <h2 className="text-3xl font-bold mb-4">{t("landing.pricing_title")}</h2>
        <p className="text-gray-400 mb-12">{t("landing.pricing_desc")}</p>
        <div className="bg-gradient-to-b from-gray-800 to-gray-900 border border-cyan-500/30 rounded-3xl p-8 md:p-12 shadow-2xl shadow-cyan-500/10">
          <div className="text-6xl font-bold mb-2">5€<span className="text-2xl text-gray-400 font-normal">/{t("landing.month")}</span></div>
          <p className="text-gray-400 mb-8">{t("landing.pricing_all_included")}</p>
          <ul className="text-left max-w-sm mx-auto space-y-3 mb-8">
            {pricingFeatures.map((feature, i) => (
              <li key={i} className="flex items-center gap-3">
                <Check className="w-5 h-5 text-cyan-400 shrink-0" />
                <span className="text-gray-300">{feature}</span>
              </li>
            ))}
          </ul>
          <Link to="/register-studio" className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-600 hover:to-violet-600 text-white font-bold py-4 px-8 rounded-xl text-lg transition w-full justify-center">
            {t("landing.cta_start")} <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 text-center text-sm text-gray-500">
        <p>© {new Date().getFullYear()} {PLATFORM_NAME} — {t("landing.footer")}</p>
      </footer>
    </div>
  );
};

export default Landing;
