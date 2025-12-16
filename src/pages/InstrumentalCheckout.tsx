import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Music, Check, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";

interface Instrumental {
  id: string;
  title: string;
  cover_image_url?: string;
  bpm?: number;
  key?: string;
  genre?: string;
}

interface License {
  id: string;
  name: string;
  price: number;
  features: string[];
}

const InstrumentalCheckout = () => {
  const { instrumentalId, licenseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [instrumental, setInstrumental] = useState<Instrumental | null>(null);
  const [license, setLicense] = useState<License | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const fetchData = async () => {
      const [instrumentalRes, licenseRes] = await Promise.all([
        supabase.from("instrumentals").select("*").eq("id", instrumentalId).single(),
        supabase.from("instrumental_licenses").select("*").eq("id", licenseId).single()
      ]);

      if (instrumentalRes.data) setInstrumental(instrumentalRes.data);
      if (licenseRes.data) setLicense(licenseRes.data);
      setLoading(false);
    };

    fetchData();
  }, [instrumentalId, licenseId, user, navigate]);

  const handleStripePayment = async () => {
    if (!instrumental || !license || !user) return;

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-instrumental-payment", {
        body: {
          instrumentalId: instrumental.id,
          licenseId: license.id,
          licenseName: license.name,
          instrumentalTitle: instrumental.title,
          amount: license.price,
          buyerEmail: user.email,
          buyerName: user.user_metadata?.full_name || user.email,
          userId: user.id
        }
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error("Payment error:", err);
      toast({
        title: "Erreur de paiement",
        description: err.message || "Une erreur est survenue lors du paiement.",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!instrumental || !license) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Produit non trouvé</h1>
          <Button onClick={() => navigate("/instrumentals")}>Retour aux instrumentaux</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="pt-24 pb-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-3xl font-bold text-center text-foreground mb-8">
            Finaliser votre achat
          </h1>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Order Summary */}
            <div className="bg-card rounded-2xl border border-border p-6">
              <h2 className="text-xl font-semibold text-foreground mb-6">Récapitulatif</h2>
              
              <div className="flex gap-4 mb-6">
                {instrumental.cover_image_url ? (
                  <img 
                    src={instrumental.cover_image_url} 
                    alt={instrumental.title}
                    className="w-24 h-24 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Music className="h-10 w-10 text-primary/40" />
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-foreground">{instrumental.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {instrumental.bpm && `${instrumental.bpm} BPM`}
                    {instrumental.key && ` • ${instrumental.key}`}
                  </p>
                  <p className="text-sm text-primary mt-1">Licence {license.name}</p>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <h4 className="font-medium text-foreground mb-3">Cette licence inclut :</h4>
                <ul className="space-y-2">
                  {license.features?.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-border mt-6 pt-4">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span className="text-foreground">Total</span>
                  <span className="text-primary">{license.price}€</span>
                </div>
              </div>
            </div>

            {/* Payment */}
            <div className="bg-card rounded-2xl border border-border p-6">
              <h2 className="text-xl font-semibold text-foreground mb-6">Paiement</h2>
              
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">
                    Vous serez redirigé vers Stripe pour finaliser votre paiement en toute sécurité.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Apple Pay et Google Pay disponibles.
                  </p>
                </div>

                <Button
                  onClick={handleStripePayment}
                  disabled={processing}
                  className="w-full h-14 text-lg bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Redirection...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-5 w-5 mr-2" />
                      Payer {license.price}€
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  En continuant, vous acceptez nos conditions de vente.
                  Votre instrumental sera livré instantanément par email après le paiement.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default InstrumentalCheckout;
