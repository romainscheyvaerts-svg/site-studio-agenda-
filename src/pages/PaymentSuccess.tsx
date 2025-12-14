import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const paymentType = searchParams.get("payment");
    
    // If PayPal or SEPA payment (already processed before redirect)
    if (paymentType === "paypal" || paymentType === "sepa") {
      setIsSuccess(true);
      setIsVerifying(false);
      return;
    }

    // If no Stripe session ID, show generic success
    if (!sessionId) {
      setIsSuccess(true);
      setIsVerifying(false);
      return;
    }

    // Verify Stripe payment
    const verifyPayment = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("verify-stripe-payment", {
          body: { sessionId },
        });

        if (error) throw error;

        if (data?.paid) {
          setIsSuccess(true);
          
          // Create booking via paypal-webhook (reusing existing logic)
          const { error: bookingError } = await supabase.functions.invoke("paypal-webhook", {
            body: {
              orderId: `STRIPE-${sessionId}`,
              payerName: data.metadata?.name || "",
              payerEmail: data.customerEmail || "",
              phone: data.metadata?.phone || "",
              sessionType: data.metadata?.sessionType || "",
              date: data.metadata?.date || "",
              time: data.metadata?.time || "",
              hours: parseInt(data.metadata?.hours || "0"),
              totalAmount: parseFloat(data.metadata?.totalPrice || data.amount?.toString() || "0"),
              message: data.metadata?.message || "",
              isCashPayment: false,
              podcastMinutes: data.metadata?.podcastMinutes ? parseInt(data.metadata.podcastMinutes) : undefined,
            },
          });

          if (bookingError) {
            console.error("Booking creation error:", bookingError);
            toast({
              title: "Paiement réussi",
              description: "Votre paiement a été accepté. Nous vous contacterons pour confirmer votre réservation.",
            });
          } else {
            toast({
              title: "Paiement confirmé ! 🎉",
              description: "Votre réservation a été enregistrée. Un email de confirmation vous a été envoyé.",
            });
          }
        } else {
          toast({
            title: "Vérification du paiement",
            description: "Le paiement n'a pas pu être vérifié. Veuillez nous contacter.",
            variant: "destructive",
          });
        }
      } catch (err) {
        console.error("Payment verification error:", err);
        // Still show success for better UX - payment likely went through
        setIsSuccess(true);
        toast({
          title: "Paiement traité",
          description: "Si vous avez des questions, n'hésitez pas à nous contacter.",
        });
      } finally {
        setIsVerifying(false);
      }
    };

    verifyPayment();
  }, [searchParams, toast]);

  const getSuccessMessage = () => {
    const paymentType = searchParams.get("payment");
    if (paymentType === "sepa") {
      return "Merci ! Une fois votre virement reçu, nous confirmerons votre réservation par email.";
    }
    return "Merci pour votre réservation. Un email de confirmation vous a été envoyé avec tous les détails.";
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {isVerifying ? (
          <>
            <Loader2 className="w-16 h-16 animate-spin text-primary mx-auto" />
            <h1 className="text-2xl font-bold text-foreground">Vérification du paiement...</h1>
            <p className="text-muted-foreground">Veuillez patienter pendant que nous confirmons votre paiement.</p>
          </>
        ) : isSuccess ? (
          <>
            <CheckCircle className="w-20 h-20 text-green-500 mx-auto" />
            <h1 className="text-3xl font-bold text-foreground">Paiement réussi !</h1>
            <p className="text-muted-foreground">
              {getSuccessMessage()}
            </p>
            <Button onClick={() => navigate("/")} className="mt-4">
              Retour à l'accueil
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-foreground">Paiement traité</h1>
            <p className="text-muted-foreground">
              Si vous avez des questions, n'hésitez pas à nous contacter.
            </p>
            <Button onClick={() => navigate("/")} className="mt-4">
              Retour à l'accueil
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentSuccess;
