import { PayPalScriptProvider, PayPalButtons, FUNDING, usePayPalScriptReducer } from "@paypal/react-paypal-js";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type SessionType = "with-engineer" | "without-engineer" | "mixing" | "mastering" | "analog-mastering" | "podcast";

interface PayPalCheckoutProps {
  amount: number;
  sessionType: SessionType;
  hours: number;
  formData: {
    name: string;
    email: string;
    phone: string;
    date: string;
    time: string;
    message: string;
  };
  clientId: string;
  onSuccess: () => void;
  isDeposit?: boolean;
  totalPrice?: number;
  podcastMinutes?: number;
}

// Inner component that uses the PayPal context
const PayPalButtonWrapper = ({ 
  amount, 
  sessionType, 
  hours, 
  formData, 
  onSuccess,
  isDeposit,
  totalPrice,
  podcastMinutes
}: Omit<PayPalCheckoutProps, 'clientId'>) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [{ isPending, isResolved, isRejected }] = usePayPalScriptReducer();
  const [showFallback, setShowFallback] = useState(false);

  // Show fallback after 10 seconds if still pending
  useEffect(() => {
    if (isPending) {
      const timeout = setTimeout(() => {
        setShowFallback(true);
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [isPending]);

  if (isPending && !showFallback) {
    return (
      <div className="flex items-center justify-center py-4 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Chargement de PayPal...</span>
      </div>
    );
  }

  if (isRejected || showFallback) {
    console.error("PayPal SDK failed to load or timed out");
    return (
      <div className="text-center py-3">
        <p className="text-muted-foreground text-sm mb-3">
          PayPal n'est pas disponible dans cet environnement.
        </p>
        <a
          href={`https://www.paypal.me/CagouleProd/${amount}EUR`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#0070ba] hover:bg-[#005ea6] text-white font-semibold rounded-lg transition-colors text-sm"
        >
          Payer {amount}€ via PayPal.me
          <ExternalLink className="w-4 h-4" />
        </a>
        <p className="text-xs text-muted-foreground mt-2">
          Après paiement, envoyez-nous la confirmation
        </p>
      </div>
    );
  }

  if (!isResolved) {
    return null;
  }

  return (
    <PayPalButtons
      fundingSource={FUNDING.PAYPAL}
      style={{
        layout: "vertical",
        color: "gold",
        shape: "rect",
        label: "paypal",
        height: 50,
      }}
      createOrder={(_data, actions) => {
        return actions.order.create({
          intent: "CAPTURE",
          purchase_units: [
            {
              amount: {
                value: amount.toString(),
                currency_code: "EUR",
              },
            },
          ],
        });
      }}
      onApprove={async (data, actions) => {
        try {
          const details = await actions.order?.capture();
          
          console.log("Payment captured:", details);

          // Call webhook to process post-payment automation
          const { data: webhookResponse, error } = await supabase.functions.invoke("paypal-webhook", {
            body: {
              orderId: data.orderID,
              payerName: formData.name,
              payerEmail: formData.email,
              phone: formData.phone,
              sessionType,
              date: formData.date,
              time: formData.time,
              hours,
              totalAmount: amount,
              message: formData.message,
              podcastMinutes: sessionType === "podcast" ? podcastMinutes : undefined,
            },
          });

          if (error) {
            console.error("Webhook error:", error);
            toast({
              title: "Paiement réussi",
              description: "Votre paiement a été effectué mais une erreur est survenue lors du traitement. Nous vous contacterons.",
              variant: "destructive",
            });
            return;
          }

          console.log("Webhook response:", webhookResponse);

          toast({
            title: "Paiement confirmé ! 🎉",
            description: isDeposit 
              ? `Acompte de ${amount}€ reçu. Session de ${hours}h réservée (total: ${totalPrice}€).`
              : `Paiement de ${amount}€ confirmé. Votre location de ${hours}h est réservée.`,
          });

          // Redirect to success page
          navigate("/success?payment=paypal");
          onSuccess();
        } catch (err) {
          console.error("Error capturing payment:", err);
          toast({
            title: "Erreur de paiement",
            description: "Une erreur est survenue lors du paiement. Veuillez réessayer.",
            variant: "destructive",
          });
        }
      }}
      onError={(err) => {
        console.error("PayPal error:", err);
        toast({
          title: "Erreur PayPal",
          description: "Une erreur est survenue avec PayPal. Veuillez réessayer.",
          variant: "destructive",
        });
      }}
    />
  );
};

const PayPalCheckout = ({ 
  amount, 
  sessionType, 
  hours, 
  formData, 
  clientId,
  onSuccess,
  isDeposit,
  totalPrice,
  podcastMinutes
}: PayPalCheckoutProps) => {
  console.log("PayPal Checkout rendering with clientId:", clientId ? "present" : "missing");

  if (!clientId) {
    return (
      <div className="text-center py-4">
        <p className="text-destructive text-sm">Configuration PayPal manquante</p>
      </div>
    );
  }

  return (
    <PayPalScriptProvider
      options={{
        clientId,
        currency: "EUR",
        intent: "capture",
      }}
    >
      <div className="paypal-button-container">
        <PayPalButtonWrapper
          amount={amount}
          sessionType={sessionType}
          hours={hours}
          formData={formData}
          onSuccess={onSuccess}
          isDeposit={isDeposit}
          totalPrice={totalPrice}
          podcastMinutes={podcastMinutes}
        />
      </div>
    </PayPalScriptProvider>
  );
};

export default PayPalCheckout;
