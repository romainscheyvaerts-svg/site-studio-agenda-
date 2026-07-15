import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { STUDIO_EMAIL } from "@/config/constants";

const LAST_UPDATED = "15 juillet 2026";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between p-6 max-w-3xl mx-auto">
        <Link to="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">Retour à l'accueil</span>
        </Link>
      </nav>

      <article className="max-w-3xl mx-auto px-6 pt-4 pb-20">
        {/* Header */}
        <div className="flex items-center gap-4 mb-2">
          <div className="w-14 h-14 bg-cyan-500/10 rounded-2xl flex items-center justify-center shrink-0">
            <ShieldCheck className="w-7 h-7 text-cyan-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold">
            Politique de confidentialité — Make Music
          </h1>
        </div>
        <p className="text-sm text-gray-500 mb-10 md:pl-[4.5rem]">
          Dernière mise à jour : {LAST_UPDATED}
        </p>

        <div className="space-y-8 text-gray-300 leading-relaxed">
          <p>
            Make Music («&nbsp;nous&nbsp;») exploite le compte Instagram professionnel{" "}
            <span className="text-white font-medium">@studio.makemusic</span> ainsi que le site{" "}
            <span className="text-white font-medium">studiomakemusic.com</span>. La présente politique
            explique comment nous traitons les données lorsque vous nous contactez, notamment via la
            messagerie Instagram.
          </p>

          <section>
            <h2 className="text-xl font-bold text-cyan-400 mb-3">1. Qui sommes-nous</h2>
            <p>
              Make Music est un studio d'enregistrement basé à Bruxelles, Belgique. Pour toute
              question relative à cette politique, contactez-nous à :{" "}
              <a href={`mailto:${STUDIO_EMAIL}`} className="text-cyan-400 hover:underline">
                {STUDIO_EMAIL}
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-cyan-400 mb-3">2. Données que nous collectons</h2>
            <p className="mb-3">
              Lorsque vous nous envoyez un message via Instagram Direct, nous recevons et traitons :
            </p>
            <ul className="list-disc pl-6 space-y-2 marker:text-cyan-400">
              <li>Votre identifiant Instagram (nom d'utilisateur, identifiant public de votre profil) ;</li>
              <li>Le contenu des messages que vous nous envoyez ;</li>
              <li>La date et l'heure de vos messages.</li>
            </ul>
            <p className="mt-3">
              Nous ne collectons pas de données de paiement, de localisation précise, ni
              d'informations sensibles via ce canal.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-cyan-400 mb-3">3. Comment nous utilisons ces données</h2>
            <p className="mb-3">Ces données sont utilisées exclusivement pour :</p>
            <ul className="list-disc pl-6 space-y-2 marker:text-cyan-400">
              <li>
                Répondre à vos demandes concernant nos services (location de studio, sessions
                d'enregistrement, mixage, mastering) ;
              </li>
              <li>
                Générer une réponse automatisée pertinente à l'aide d'un assistant conversationnel
                basé sur l'intelligence artificielle (Claude, développé par Anthropic), afin de vous
                orienter vers les bonnes informations ou vers une prise de contact humaine ;
              </li>
              <li>Assurer le suivi de nos échanges commerciaux.</li>
            </ul>
            <p className="mt-3">
              Nous ne vendons ni ne partageons vos données avec des tiers à des fins commerciales ou
              publicitaires.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-cyan-400 mb-3">4. Sous-traitants et transfert de données</h2>
            <p className="mb-3">
              Pour fonctionner, notre système technique s'appuie sur les prestataires suivants, qui
              peuvent traiter le contenu de vos messages en notre nom :
            </p>
            <ul className="list-disc pl-6 space-y-2 marker:text-cyan-400">
              <li>
                <span className="text-white font-medium">Meta Platforms, Inc.</span> — fournisseur de
                l'API Instagram Messaging ;
              </li>
              <li>
                <span className="text-white font-medium">Anthropic PBC</span> — fournisseur du modèle
                d'intelligence artificielle (Claude) utilisé pour générer les réponses ;
              </li>
              <li>
                <span className="text-white font-medium">n8n</span> — plateforme d'automatisation
                utilisée pour orchestrer la réception et l'envoi des messages.
              </li>
            </ul>
            <p className="mt-3">
              Ces prestataires traitent les données uniquement dans le cadre technique nécessaire au
              fonctionnement du service, conformément à leurs propres politiques de confidentialité
              respectives.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-cyan-400 mb-3">5. Durée de conservation</h2>
            <p>
              Les messages échangés sont conservés le temps nécessaire à la gestion de la relation
              commerciale, et au maximum 12 mois après le dernier échange, sauf obligation légale
              contraire.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-cyan-400 mb-3">6. Vos droits</h2>
            <p>
              Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez
              d'un droit d'accès, de rectification, d'effacement et de portabilité de vos données,
              ainsi que d'un droit d'opposition. Pour exercer ces droits, contactez-nous à{" "}
              <a href={`mailto:${STUDIO_EMAIL}`} className="text-cyan-400 hover:underline">
                {STUDIO_EMAIL}
              </a>
              . Vous pouvez également introduire une réclamation auprès de l'Autorité de protection
              des données belge (APD).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-cyan-400 mb-3">7. Sécurité</h2>
            <p>
              Nous mettons en œuvre des mesures raisonnables pour protéger vos données contre l'accès
              non autorisé, la perte ou la divulgation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-cyan-400 mb-3">8. Modifications</h2>
            <p>
              Cette politique peut être mise à jour. La date de dernière mise à jour est indiquée en
              haut de cette page.
            </p>
          </section>
        </div>

        {/* Footer signature */}
        <footer className="mt-14 pt-8 border-t border-gray-800 text-center text-sm text-gray-500">
          <p>
            Make Music — Bruxelles, Belgique —{" "}
            <a href={`mailto:${STUDIO_EMAIL}`} className="text-cyan-400 hover:underline">
              {STUDIO_EMAIL}
            </a>
          </p>
        </footer>
      </article>
    </div>
  );
};

export default PrivacyPolicy;
