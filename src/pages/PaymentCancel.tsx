import { useNavigate } from "react-router-dom";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const PaymentCancel = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <XCircle className="w-20 h-20 text-orange-500 mx-auto" />
        <h1 className="text-3xl font-bold text-foreground">Paiement annulé</h1>
        <p className="text-muted-foreground">
          Votre paiement a été annulé. Aucun montant n'a été débité de votre compte.
        </p>
        <p className="text-sm text-muted-foreground">
          Vous pouvez revenir à la page de réservation pour réessayer ou choisir un autre moyen de paiement.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4">
          <Button onClick={() => navigate("/#booking")} variant="default">
            Réessayer la réservation
          </Button>
          <Button onClick={() => navigate("/")} variant="outline">
            Retour à l'accueil
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PaymentCancel;
