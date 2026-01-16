import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const AdminPaymentConfig = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stripeEnabled, setStripeEnabled] = useState(true);
  const [paypalEnabled, setPaypalEnabled] = useState(true);

  useEffect(() => {
    fetchPaymentConfig();
  }, []);

  const fetchPaymentConfig = async () => {
    setLoading(true);
    try {
      // Fetch stripe_enabled
      const { data: stripeData } = await supabase
        .from("site_config")
        .select("config_value")
        .eq("config_key", "stripe_enabled")
        .single();

      // Fetch paypal_enabled
      const { data: paypalData } = await supabase
        .from("site_config")
        .select("config_value")
        .eq("config_key", "paypal_enabled")
        .single();

      if (stripeData) {
        setStripeEnabled(stripeData.config_value === "true");
      }
      if (paypalData) {
        setPaypalEnabled(paypalData.config_value === "true");
      }
    } catch (err) {
      console.error("Error fetching payment config:", err);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (key: string, value: boolean) => {
    setSaving(true);
    try {
      // Try to update first
      const { data: existing } = await supabase
        .from("site_config")
        .select("id")
        .eq("config_key", key)
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("site_config")
          .update({ 
            config_value: value.toString(),
            updated_at: new Date().toISOString()
          })
          .eq("config_key", key);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("site_config")
          .insert({
            config_key: key,
            config_value: value.toString(),
            description: key === "stripe_enabled" 
              ? "Activer les paiements par carte (Stripe)" 
              : "Activer les paiements PayPal"
          });

        if (error) throw error;
      }

      toast({
        title: "Configuration sauvegardée",
        description: `${key === "stripe_enabled" ? "Stripe" : "PayPal"} ${value ? "activé" : "désactivé"}`,
      });
    } catch (err) {
      console.error("Error saving config:", err);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder la configuration",
        variant: "destructive",
      });
      // Revert UI state
      if (key === "stripe_enabled") setStripeEnabled(!value);
      if (key === "paypal_enabled") setPaypalEnabled(!value);
    } finally {
      setSaving(false);
    }
  };

  const handleStripeToggle = (checked: boolean) => {
    // Prevent disabling both payment methods
    if (!checked && !paypalEnabled) {
      toast({
        title: "Action impossible",
        description: "Au moins un mode de paiement doit rester actif",
        variant: "destructive",
      });
      return;
    }
    setStripeEnabled(checked);
    saveConfig("stripe_enabled", checked);
  };

  const handlePaypalToggle = (checked: boolean) => {
    // Prevent disabling both payment methods
    if (!checked && !stripeEnabled) {
      toast({
        title: "Action impossible",
        description: "Au moins un mode de paiement doit rester actif",
        variant: "destructive",
      });
      return;
    }
    setPaypalEnabled(checked);
    saveConfig("paypal_enabled", checked);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Moyens de paiement</h3>
      </div>

      <div className="space-y-4">
        {/* Stripe Toggle */}
        <div className={cn(
          "flex items-center justify-between p-4 rounded-lg border transition-all",
          stripeEnabled 
            ? "bg-blue-500/10 border-blue-500/30" 
            : "bg-muted/30 border-border"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              stripeEnabled ? "bg-blue-500/20" : "bg-muted"
            )}>
              <svg viewBox="0 0 24 24" className={cn("w-6 h-6", stripeEnabled ? "text-blue-500" : "text-muted-foreground")}>
                <path fill="currentColor" d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
              </svg>
            </div>
            <div>
              <Label className="text-foreground font-medium">Paiement par carte (Stripe)</Label>
              <p className="text-xs text-muted-foreground">
                Carte bancaire, Apple Pay, Google Pay
              </p>
            </div>
          </div>
          <Switch
            checked={stripeEnabled}
            onCheckedChange={handleStripeToggle}
            disabled={saving}
          />
        </div>

        {/* PayPal Toggle */}
        <div className={cn(
          "flex items-center justify-between p-4 rounded-lg border transition-all",
          paypalEnabled 
            ? "bg-amber-500/10 border-amber-500/30" 
            : "bg-muted/30 border-border"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              paypalEnabled ? "bg-amber-500/20" : "bg-muted"
            )}>
              <svg viewBox="0 0 24 24" className={cn("w-6 h-6", paypalEnabled ? "text-amber-500" : "text-muted-foreground")}>
                <path fill="currentColor" d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z"/>
              </svg>
            </div>
            <div>
              <Label className="text-foreground font-medium">PayPal</Label>
              <p className="text-xs text-muted-foreground">
                Paiement via compte PayPal
              </p>
            </div>
          </div>
          <Switch
            checked={paypalEnabled}
            onCheckedChange={handlePaypalToggle}
            disabled={saving}
          />
        </div>
      </div>

      {/* Status indicator */}
      <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Check className="w-3 h-3 text-green-500" />
          {stripeEnabled && paypalEnabled && "Les deux modes de paiement sont actifs"}
          {stripeEnabled && !paypalEnabled && "Seul Stripe (carte) est actif"}
          {!stripeEnabled && paypalEnabled && "Seul PayPal est actif"}
        </p>
      </div>
    </div>
  );
};

export default AdminPaymentConfig;
