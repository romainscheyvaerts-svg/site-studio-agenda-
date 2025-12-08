import { PayPalScriptProvider, PayPalButtons, FUNDING, usePayPalScriptReducer } from "@paypal/react-paypal-js";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface PayPalCheckoutProps {
  amount: number;
  sessionType: "with-engineer" | "without-engineer";
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
}

// Inner component that uses the PayPal context
const PayPalButtonWrapper = ({ 
  amount, 
  sessionType, 
  hours, 
  formData, 
  onSuccess 
}: Omit<PayPalCheckoutProps, 'clientId'>) => {
  const { toast } = useToast();
  const [{ isPending, isRejected }] = usePayPalScriptReducer();

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-4 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Chargement de PayPal...</span>
      </div>
    );
  }

  if (isRejected) {
    console.error("PayPal SDK failed to load");
    return (
      <div className="text-center py-4">
        <p className="text-destructive text-sm">Impossible de charger PayPal. Utilisez Revolut ci-dessous.</p>
      </div>
    );
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
            description: `Votre session de ${hours}h est réservée. Vous recevrez un email de confirmation.`,
          });

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
  onSuccess 
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
        />
      </div>
    </PayPalScriptProvider>
  );
};

export default PayPalCheckout;
