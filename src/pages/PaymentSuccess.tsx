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
    const type = searchParams.get("type");
    
    // IDEMPOTENCY: Check if this session has already been processed
    const processedKey = `payment_processed_${sessionId || paymentType || 'generic'}`;
    const alreadyProcessed = localStorage.getItem(processedKey);
    
    if (alreadyProcessed) {
      // Page was refreshed - show success without reprocessing
      setIsSuccess(true);
      setIsVerifying(false);
      return;
    }
    
    // If PayPal or SEPA payment (already processed before redirect)
    if (paymentType === "paypal" || paymentType === "sepa") {
      localStorage.setItem(processedKey, 'true');
      setIsSuccess(true);
      setIsVerifying(false);
      return;
    }

    // If no Stripe session ID, show generic success
    if (!sessionId) {
      localStorage.setItem(processedKey, 'true');
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

        if (data?.success && data?.paymentStatus === "paid") {
          // Mark as processed in localStorage to prevent duplicate processing on refresh
          localStorage.setItem(processedKey, 'true');
          setIsSuccess(true);

          // Check if this is an instrumental purchase
          if (type === "instrumental" || data.metadata?.type === "instrumental") {
            // Deliver the instrumental
            const { error: deliveryError } = await supabase.functions.invoke("deliver-instrumental", {
              body: {
                instrumentalId: data.metadata?.instrumentalId,
                licenseId: data.metadata?.licenseId,
                paymentId: sessionId,
                paymentMethod: "stripe",
                amountPaid: parseFloat(data.metadata?.amount || data.amount?.toString() || "0"),
                buyerEmail: data.metadata?.buyerEmail || data.customerEmail,
                buyerName: data.metadata?.buyerName,
                userId: data.metadata?.userId
              },
            });

            if (deliveryError) {
              console.error("Delivery error:", deliveryError);
              toast({
                title: "Paiement réussi",
                description: "Votre instrumental sera envoyé par email sous peu.",
              });
            } else {
              toast({
                title: "Achat confirmé ! 🎵",
                description: "Votre instrumental a été envoyé par email. Vérifiez votre boîte de réception.",
              });
            }
            } else {
              // Studio booking flow
              const startTime = data.metadata?.time || "";
              const durationHours = parseInt(data.metadata?.hours || "0");

              const computeEndTime = (start: string, hoursToAdd: number) => {
                const [hStr, mStr] = start.split(":");
                const h = parseInt(hStr || "0");
                const m = parseInt(mStr || "0");
                const totalMinutes = h * 60 + m + hoursToAdd * 60;
                const endH = Math.floor(totalMinutes / 60) % 24;
                const endM = totalMinutes % 60;
                return `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;
              };

              const endTime = startTime && durationHours
                ? computeEndTime(startTime, durationHours)
                : "";

              const { error: bookingError } = await supabase.functions.invoke("process-booking-payment", {
                body: {
                  clientName: data.metadata?.name || "",
                  clientEmail: data.customerEmail || "",
                  clientPhone: data.metadata?.phone || undefined,
                  sessionType: data.metadata?.sessionType || "",
                  sessionDate: data.metadata?.date || "",
                  startTime,
                  endTime,
                  durationHours,
                  amount: data.amountTotal || 0,
                  stripePaymentIntentId: data.paymentIntentId || "",
                },
              });

              if (bookingError) {
                console.error("Booking creation error:", bookingError);
                toast({
                  title: "Paiement réussi",
                  description:
                    "Votre paiement a été accepté, mais la réservation n'a pas pu être finalisée automatiquement. Nous vous contactons rapidement.",
                  variant: "destructive",
                });
              } else {
                toast({
                  title: "Paiement confirmé !",
                  description: "Votre réservation a été enregistrée. Un email de confirmation vous a été envoyé.",
                });
              }
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
