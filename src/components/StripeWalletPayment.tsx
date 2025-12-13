import { useState, useEffect, useCallback } from "react";
import { loadStripe, Stripe, PaymentRequest, PaymentRequestPaymentMethodEvent } from "@stripe/stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface StripeWalletPaymentProps {
  amount: number;
  sessionType: string;
  hours: number;
  formData: {
    name: string;
    email: string;
    phone: string;
    date: string;
    time: string;
    message: string;
  };
  isDeposit: boolean;
  totalPrice: number;
  podcastMinutes?: number;
  onSuccess: () => void;
}

const StripeWalletPayment = ({
  amount,
  sessionType,
  hours,
  formData,
  isDeposit,
  totalPrice,
  podcastMinutes,
  onSuccess,
}: StripeWalletPaymentProps) => {
  const { toast } = useToast();
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [canMakePayment, setCanMakePayment] = useState<{ applePay: boolean; googlePay: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Initialize Stripe
  useEffect(() => {
    const initStripe = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-stripe-publishable-key");
        if (error) throw error;
        
        const stripeInstance = await loadStripe(data.publishableKey);
        setStripe(stripeInstance);
      } catch (err) {
        console.error("Failed to load Stripe:", err);
        toast({
          title: "Erreur",
          description: "Impossible de charger le système de paiement.",
          variant: "destructive",
        });
        setIsLoading(false);
      }
    };
    
    initStripe();
  }, [toast]);

  // Setup Payment Request when Stripe is ready
  useEffect(() => {
    if (!stripe || amount <= 0) return;

    const pr = stripe.paymentRequest({
      country: "BE",
      currency: "eur",
      total: {
        label: "Make Music Studio",
        amount: Math.round(amount * 100), // Convert to cents
      },
      requestPayerName: true,
      requestPayerEmail: true,
    });

    // Check what payment methods are available
    pr.canMakePayment().then((result) => {
      if (result) {
        setCanMakePayment({
          applePay: result.applePay || false,
          googlePay: result.googlePay || false,
        });
        setPaymentRequest(pr);
      } else {
        setCanMakePayment({ applePay: false, googlePay: false });
      }
      setIsLoading(false);
    });
  }, [stripe, amount]);

  // Handle payment method submission
  const handlePayment = useCallback(async (paymentMethod: "applePay" | "googlePay") => {
    if (!stripe || !paymentRequest) return;

    setIsProcessing(true);

    try {
      // Create PaymentIntent on the server
      const { data: intentData, error: intentError } = await supabase.functions.invoke("create-stripe-payment-intent", {
        body: {
          amount,
          email: formData.email,
          name: formData.name,
          phone: formData.phone,
          sessionType,
          hours,
          date: formData.date,
          time: formData.time,
          isDeposit,
          totalPrice,
          podcastMinutes,
          message: formData.message,
        },
      });

      if (intentError) throw intentError;
      if (!intentData?.clientSecret) throw new Error("No client secret received");

      // Update the payment request with the client secret
      const pr = stripe.paymentRequest({
        country: "BE",
        currency: "eur",
        total: {
          label: "Make Music Studio",
          amount: Math.round(amount * 100),
        },
        requestPayerName: true,
        requestPayerEmail: true,
      });

      pr.on("paymentmethod", async (ev: PaymentRequestPaymentMethodEvent) => {
        // Confirm the payment
        const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
          intentData.clientSecret,
          { payment_method: ev.paymentMethod.id },
          { handleActions: false }
        );

        if (confirmError) {
          ev.complete("fail");
          toast({
            title: "Erreur de paiement",
            description: confirmError.message || "Le paiement a échoué.",
            variant: "destructive",
          });
          setIsProcessing(false);
          return;
        }

        if (paymentIntent?.status === "requires_action") {
          // Handle 3D Secure
          const { error: actionError } = await stripe.confirmCardPayment(intentData.clientSecret);
          if (actionError) {
            ev.complete("fail");
            toast({
              title: "Erreur de vérification",
              description: actionError.message || "La vérification 3D Secure a échoué.",
              variant: "destructive",
            });
            setIsProcessing(false);
            return;
          }
        }

        ev.complete("success");

        // Create booking via paypal-webhook (reusing existing logic)
        try {
          const { error: bookingError } = await supabase.functions.invoke("paypal-webhook", {
            body: {
              orderId: `STRIPE-${intentData.paymentIntentId}`,
              payerName: formData.name,
              payerEmail: formData.email,
              phone: formData.phone,
              sessionType,
              date: formData.date,
              time: formData.time,
              hours,
              totalAmount: totalPrice,
              message: formData.message,
              isCashPayment: false,
              podcastMinutes,
            },
          });

          if (bookingError) throw bookingError;

          toast({
            title: "Paiement confirmé ! 🎉",
            description: "Votre réservation a été enregistrée. Un email de confirmation vous a été envoyé.",
          });

          onSuccess();
        } catch (bookingErr) {
          console.error("Booking creation error:", bookingErr);
          toast({
            title: "Paiement réussi",
            description: "Votre paiement a été accepté. Nous vous contacterons pour confirmer votre réservation.",
          });
        }

        setIsProcessing(false);
      });

      // Show the payment sheet
      pr.show();

    } catch (err) {
      console.error("Payment error:", err);
      toast({
        title: "Erreur",
        description: "Impossible de créer la session de paiement. Veuillez réessayer.",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  }, [stripe, paymentRequest, amount, formData, sessionType, hours, isDeposit, totalPrice, podcastMinutes, toast, onSuccess]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // If neither Apple Pay nor Google Pay is available
  if (!canMakePayment?.applePay && !canMakePayment?.googlePay) {
    return (
      <div className="text-center py-3 text-sm text-muted-foreground">
        <p>Apple Pay / Google Pay non disponible sur cet appareil.</p>
        <p className="text-xs mt-1">Utilisez PayPal ou le virement bancaire.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Apple Pay Button */}
      {canMakePayment?.applePay && (
        <button
          type="button"
          onClick={() => handlePayment("applePay")}
          disabled={isProcessing}
          className={cn(
            "flex items-center justify-center gap-3 w-full py-3.5 px-4 bg-black hover:bg-black/90 text-white font-semibold rounded-lg transition-all",
            isProcessing && "opacity-70 cursor-not-allowed"
          )}
        >
          {isProcessing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.0425 8.1725C16.9875 8.2225 15.7425 8.9225 15.7425 10.4475C15.7425 12.2225 17.3175 12.8475 17.3625 12.8625C17.3525 12.8975 17.1075 13.7225 16.5225 14.5675C16.0025 15.3175 15.4575 16.0625 14.6325 16.0625C13.8075 16.0625 13.5425 15.5875 12.5925 15.5875C11.6675 15.5875 11.2675 16.0775 10.5075 16.0775C9.7475 16.0775 9.2175 15.3925 8.6075 14.5475C7.9025 13.5575 7.3325 12.0225 7.3325 10.5675C7.3325 8.2925 8.8125 7.0825 10.2675 7.0825C11.0675 7.0825 11.7375 7.6025 12.2425 7.6025C12.7225 7.6025 13.4775 7.0525 14.4025 7.0525C14.7675 7.0525 16.0125 7.0825 16.9525 8.1725H17.0425ZM14.0175 5.6775C14.4175 5.1925 14.6925 4.5275 14.6925 3.8625C14.6925 3.7625 14.6825 3.6625 14.6625 3.5775C14.0075 3.6025 13.2275 4.0175 12.7525 4.5675C12.3775 4.9875 12.0425 5.6525 12.0425 6.3275C12.0425 6.4375 12.0575 6.5475 12.0675 6.5825C12.1125 6.5925 12.1875 6.6025 12.2625 6.6025C12.8525 6.6025 13.5925 6.2075 14.0175 5.6775Z"/>
              </svg>
              <span>Apple Pay</span>
            </>
          )}
          <span className="ml-auto text-sm opacity-80">{amount}€</span>
        </button>
      )}

      {/* Google Pay Button */}
      {canMakePayment?.googlePay && (
        <button
          type="button"
          onClick={() => handlePayment("googlePay")}
          disabled={isProcessing}
          className={cn(
            "flex items-center justify-center gap-3 w-full py-3.5 px-4 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-lg border border-gray-300 transition-all",
            isProcessing && "opacity-70 cursor-not-allowed"
          )}
        >
          {isProcessing ? (
            <Loader2 className="w-5 h-5 animate-spin text-gray-600" />
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>Google Pay</span>
            </>
          )}
          <span className="ml-auto text-sm text-gray-600">{amount}€</span>
        </button>
      )}
    </div>
  );
};

export default StripeWalletPayment;
