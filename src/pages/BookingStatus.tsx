import { useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function BookingStatus() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get('status');
  const name = searchParams.get('name');
  const isConfirmed = status === 'confirmed';

  useEffect(() => {
    document.title = `${isConfirmed ? 'Réservation confirmée' : 'Réservation annulée'} | Make Music Studio`;
  }, [isConfirmed]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            {isConfirmed ? (
              <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
            ) : (
              <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            )}
            <CardTitle className={isConfirmed ? 'text-emerald-500' : 'text-red-500'}>
              {isConfirmed ? 'Session confirmée !' : 'Session annulée'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {isConfirmed ? (
              <>
                <p className="text-muted-foreground">
                  La session de <strong>{name}</strong> a été confirmée avec succès.
                </p>
                <p className="text-sm text-muted-foreground">
                  Un email de confirmation a été envoyé au client avec tous les détails.
                </p>
              </>
            ) : (
              <>
                <p className="text-muted-foreground">
                  La session de <strong>{name}</strong> a été annulée.
                </p>
                <p className="text-sm text-muted-foreground">
                  Le remboursement a été initié et le client a été notifié par email.
                </p>
              </>
            )}

            <div className="pt-4">
              <Button asChild variant="outline">
                <Link to="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Retour à l'accueil
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
