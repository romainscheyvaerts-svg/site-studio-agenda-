import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

interface StripeCheckoutButtonProps {
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
}

const StripeCheckoutButton = ({
  amount,
  sessionType,
  hours,
  formData,
  isDeposit,
  totalPrice,
  podcastMinutes,
}: StripeCheckoutButtonProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleCheckout = async () => {
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-stripe-payment", {
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

      if (error) throw error;

      if (data?.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (err) {
      console.error("Checkout error:", err);
      toast({
        title: "Erreur",
        description: "Impossible de créer la session de paiement. Veuillez réessayer.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCheckout}
      disabled={isLoading}
      className={cn(
        "flex items-center justify-center gap-3 w-full py-3.5 px-4",
        "bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-all",
        isLoading && "opacity-70 cursor-not-allowed"
      )}
    >
      {isLoading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <>
          <CreditCard className="w-5 h-5" />
          <span>Payer par carte</span>
          <span className="ml-auto text-sm opacity-80">{amount}€</span>
        </>
      )}
    </button>
  );
};

export default StripeCheckoutButton;
