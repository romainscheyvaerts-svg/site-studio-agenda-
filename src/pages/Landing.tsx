import { Link, useNavigate } from "react-router-dom";
import { Music, Calendar, CreditCard, Shield, Headphones, ArrowRight, Check, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const Landing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin = user?.email === "romain.scheyvaerts@gmail.com";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white">
      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-violet-500/10" />
        <nav className="relative z-10 flex items-center justify-between p-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <Headphones className="w-8 h-8 text-cyan-400" />
            <span className="text-xl font-bold">StudioBooking</span>
          </div>
          <div className="flex gap-4 items-center">
            {isSuperAdmin && (
              <Link to="/super-admin" className="px-3 py-1.5 text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/30 transition flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" /> Admin
              </Link>
            )}
            {user ? (
              <>
                <Link to="/register-studio" className="px-4 py-2 text-sm bg-cyan-500 hover:bg-cyan-600 rounded-lg transition font-medium">
                  Mon studio
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" /> Déconnexion
                </button>
              </>
            ) : (
              <>
                <Link to="/auth" className="px-4 py-2 text-sm text-gray-300 hover:text-white transition">
                  Connexion
                </Link>
                <Link to="/register-studio" className="px-4 py-2 text-sm bg-cyan-500 hover:bg-cyan-600 rounded-lg transition font-medium">
                  Créer mon studio
                </Link>
              </>
            )}
          </div>
        </nav>

        <div className="relative z-10 max-w-4xl mx-auto text-center py-24 px-6">
          <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-4 py-1.5 mb-6">
            <span className="text-cyan-400 text-sm font-medium">🎵 La plateforme de booking pour studios</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-cyan-200 to-violet-200 bg-clip-text text-transparent">
            Votre studio mérite un agenda professionnel
          </h1>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            Réservation en ligne, paiements automatiques, Google Calendar, gestion des clients — tout en un pour seulement <span className="text-cyan-400 font-bold">5€/mois</span>.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register-studio" className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-600 hover:to-violet-600 text-white font-bold py-4 px-8 rounded-xl text-lg transition shadow-lg shadow-cyan-500/25">
              Commencer gratuitement <ArrowRight className="w-5 h-5" />
            </Link>
            <a href="#features" className="inline-flex items-center gap-2 border border-gray-700 hover:border-gray-500 text-gray-300 font-medium py-4 px-8 rounded-xl text-lg transition">
              Découvrir les fonctionnalités
            </a>
          </div>
          <p className="text-sm text-gray-500 mt-4">14 jours d'essai gratuit • Aucune carte requise</p>
        </div>
      </header>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto py-20 px-6">
        <h2 className="text-3xl font-bold text-center mb-4">Tout ce dont votre studio a besoin</h2>
        <p className="text-gray-400 text-center mb-12 max-w-xl mx-auto">
          Une plateforme complète pour gérer vos réservations et développer votre studio.
        </p>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: Calendar, title: "Agenda en ligne", desc: "Synchronisation Google Calendar, créneaux automatiques, gestion des conflits." },
            { icon: CreditCard, title: "Paiements intégrés", desc: "Stripe & PayPal, acomptes automatiques, remboursements en un clic." },
            { icon: Music, title: "Vente d'instrumentaux", desc: "Boutique intégrée avec licences, téléchargement et paiement." },
            { icon: Shield, title: "Données sécurisées", desc: "Chaque studio a ses propres données isolées et sécurisées." },
            { icon: Headphones, title: "Chatbot IA", desc: "Assistant intelligent pour qualifier vos clients 24/7." },
            { icon: ArrowRight, title: "Emails automatiques", desc: "Confirmations, rappels et factures personnalisables." },
          ].map(({ icon: Icon, title, desc }, i) => (
            <div key={i} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6 hover:border-cyan-500/30 transition">
              <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-4">
                <Icon className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{title}</h3>
              <p className="text-gray-400 text-sm">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-3xl mx-auto py-20 px-6 text-center">
        <h2 className="text-3xl font-bold mb-4">Un prix simple et transparent</h2>
        <p className="text-gray-400 mb-12">Pas de frais cachés. Annulable à tout moment.</p>
        <div className="bg-gradient-to-b from-gray-800 to-gray-900 border border-cyan-500/30 rounded-3xl p-8 md:p-12 shadow-2xl shadow-cyan-500/10">
          <div className="text-6xl font-bold mb-2">5€<span className="text-2xl text-gray-400 font-normal">/mois</span></div>
          <p className="text-gray-400 mb-8">Tout inclus, nombre de clients illimité</p>
          <ul className="text-left max-w-sm mx-auto space-y-3 mb-8">
            {[
              "Agenda de réservation en ligne",
              "Paiements Stripe & PayPal",
              "Synchronisation Google Calendar",
              "Dossiers Google Drive clients",
              "Emails automatiques personnalisables",
              "Chatbot IA intégré",
              "Vente d'instrumentaux",
              "Galerie photos",
              "Multi-langue (FR/EN/NL/ES)",
              "Support technique",
            ].map((feature, i) => (
              <li key={i} className="flex items-center gap-3">
                <Check className="w-5 h-5 text-cyan-400 shrink-0" />
                <span className="text-gray-300">{feature}</span>
              </li>
            ))}
          </ul>
          <Link to="/register-studio" className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-600 hover:to-violet-600 text-white font-bold py-4 px-8 rounded-xl text-lg transition w-full justify-center">
            Commencer 14 jours gratuits <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 text-center text-sm text-gray-500">
        <p>© {new Date().getFullYear()} StudioBooking — Plateforme de réservation pour studios d'enregistrement</p>
      </footer>
    </div>
  );
};

export default Landing;
