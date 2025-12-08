import { PayPalScriptProvider, PayPalButtons, FUNDING } from "@paypal/react-paypal-js";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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

const PayPalCheckout = ({ 
  amount, 
  sessionType, 
  hours, 
  formData, 
  clientId,
  onSuccess 
}: PayPalCheckoutProps) => {
  const { toast } = useToast();

  return (
    <PayPalScriptProvider
      options={{
        clientId,
        currency: "EUR",
        intent: "capture",
      }}
    >
      <div className="paypal-button-container">
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
      </div>
    </PayPalScriptProvider>
  );
};

export default PayPalCheckout;
