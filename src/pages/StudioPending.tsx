import { Headphones, Clock, Mail } from "lucide-react";
import { Link } from "react-router-dom";

const StudioPending = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white flex flex-col">
      {/* Header */}
      <nav className="flex items-center justify-between p-6 max-w-7xl mx-auto w-full">
        <Link to="/" className="flex items-center gap-2">
          <Headphones className="w-8 h-8 text-cyan-400" />
          <span className="text-xl font-bold">StudioBooking</span>
        </Link>
      </nav>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6 pb-20">
        <div className="w-full max-w-lg text-center space-y-6">
          <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto">
            <Clock className="w-10 h-10 text-amber-400" />
          </div>
          
          <h1 className="text-3xl font-bold">Demande en cours de validation</h1>
          
          <p className="text-gray-400 text-lg">
            Votre demande d'inscription studio a bien été reçue ! 
            Notre équipe va vérifier votre studio et vous envoyer une confirmation par email.
          </p>

          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2 justify-center">
              <Mail className="w-5 h-5 text-cyan-400" /> Prochaines étapes
            </h3>
            <ul className="text-left text-gray-300 space-y-3">
              <li className="flex items-start gap-3">
                <span className="bg-cyan-500/20 text-cyan-400 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">1</span>
                <span>Notre équipe examine votre demande (généralement sous 24-48h)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-cyan-500/20 text-cyan-400 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">2</span>
                <span>Vous recevrez un email de confirmation une fois approuvé</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-cyan-500/20 text-cyan-400 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">3</span>
                <span>Vous pourrez alors configurer vos salles, tarifs et commencer à recevoir des réservations</span>
              </li>
            </ul>
          </div>

          <div className="pt-4">
            <Link 
              to="/" 
              className="text-cyan-400 hover:underline"
            >
              ← Retour à l'accueil
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudioPending;
