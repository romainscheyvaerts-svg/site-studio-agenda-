import { useParams, Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Calendar, CreditCard, Music, Shield, Headphones, ArrowRight, Mail, Check, Globe } from "lucide-react";

const featureKeys = ["agenda", "payments", "instrumentals", "security", "chatbot", "emails"] as const;
type FeatureKey = typeof featureKeys[number];

const featureIcons: Record<FeatureKey, React.ElementType> = {
  agenda: Calendar,
  payments: CreditCard,
  instrumentals: Music,
  security: Shield,
  chatbot: Headphones,
  emails: Mail,
};

const FeatureDetail = () => {
  const { featureId } = useParams<{ featureId: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const key = featureId as FeatureKey;
  if (!featureKeys.includes(key)) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">404</h1>
          <p className="text-gray-400 mb-6">{t("landing.feature_not_found")}</p>
          <Link to="/" className="text-cyan-400 hover:underline">{t("landing.back_home")}</Link>
        </div>
      </div>
    );
  }

  const Icon = featureIcons[key];
  const title = t(`landing.features.${key}.title`);
  const subtitle = t(`landing.features.${key}.desc`);
  const details = t(`landing.features.${key}.details`, { returnObjects: true }) as string[];
  const howTo = t(`landing.features.${key}.howto`, { returnObjects: true }) as string[];

  const currentFeatureIndex = featureKeys.indexOf(key);
  const prevFeature = currentFeatureIndex > 0 ? featureKeys[currentFeatureIndex - 1] : null;
  const nextFeature = currentFeatureIndex < featureKeys.length - 1 ? featureKeys[currentFeatureIndex + 1] : null;

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between p-6 max-w-5xl mx-auto">
        <Link to="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">{t("landing.back_home")}</span>
        </Link>
        {/* Language switcher */}
        <div className="flex gap-2">
          {[
            { code: "fr", flag: "🇫🇷" },
            { code: "en", flag: "🇬🇧" },
            { code: "nl", flag: "🇳🇱" },
            { code: "es", flag: "🇪🇸" },
          ].map(({ code, flag }) => (
            <button
              key={code}
              onClick={() => changeLanguage(code)}
              className={`text-lg px-2 py-1 rounded transition ${
                i18n.language?.startsWith(code)
                  ? "bg-cyan-500/20 border border-cyan-500/50"
                  : "hover:bg-gray-800"
              }`}
            >
              {flag}
            </button>
          ))}
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-6 pt-8 pb-16">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 bg-cyan-500/10 rounded-2xl flex items-center justify-center">
            <Icon className="w-8 h-8 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-bold">{title}</h1>
            <p className="text-gray-400 text-lg mt-1">{subtitle}</p>
          </div>
        </div>

        {/* Detailed explanation */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6 text-cyan-400">{t("landing.what_it_does")}</h2>
          <ul className="space-y-4">
            {Array.isArray(details) && details.map((detail, i) => (
              <li key={i} className="flex items-start gap-3">
                <Check className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
                <span className="text-gray-300">{detail}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* How to configure */}
        <div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 border border-cyan-500/20 rounded-2xl p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6 text-cyan-400">🛠️ {t("landing.how_to_configure")}</h2>
          <ol className="space-y-4">
            {Array.isArray(howTo) && howTo.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-7 h-7 bg-cyan-500/20 text-cyan-400 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                  {i + 1}
                </span>
                <span className="text-gray-300">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Navigation between features */}
        <div className="flex justify-between items-center pt-8 border-t border-gray-800">
          {prevFeature ? (
            <Link
              to={`/features/${prevFeature}`}
              className="flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">{t(`landing.features.${prevFeature}.title`)}</span>
            </Link>
          ) : <div />}
          {nextFeature ? (
            <Link
              to={`/features/${nextFeature}`}
              className="flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition"
            >
              <span className="text-sm">{t(`landing.features.${nextFeature}.title`)}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : <div />}
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <Link
            to="/register-studio"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-600 hover:to-violet-600 text-white font-bold py-4 px-8 rounded-xl text-lg transition shadow-lg shadow-cyan-500/25"
          >
            {t("landing.cta_start")} <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="text-sm text-gray-500 mt-3">{t("landing.cta_trial")}</p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 text-center text-sm text-gray-500">
        <p>© {new Date().getFullYear()} StudioBooking</p>
      </footer>
    </div>
  );
};

export default FeatureDetail;
