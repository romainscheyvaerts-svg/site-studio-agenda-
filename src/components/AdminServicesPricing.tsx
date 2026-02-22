import { useState, useEffect } from "react";
import { Save, Tag, Percent, Euro, Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Service {
  id: string;
  service_key: string;
  name_fr: string;
  base_price: number;
  price_unit: string;
  is_active: boolean;
  sort_order: number;
}

interface SalesConfig {
  id: string;
  is_active: boolean;
  sale_name: string;
  discount_percentage: number;
  discount_with_engineer: number;
  discount_without_engineer: number;
  discount_mixing: number;
  discount_mastering: number;
  discount_analog_mastering: number;
  discount_podcast: number;
  discount_composition: number;
}

// Map service_key to discount field
const serviceKeyToDiscountField: Record<string, keyof SalesConfig> = {
  'with-engineer': 'discount_with_engineer',
  'without-engineer': 'discount_without_engineer',
  'mixing': 'discount_mixing',
  'mastering': 'discount_mastering',
  'analog-mastering': 'discount_analog_mastering',
  'podcast': 'discount_podcast',
  'composition': 'discount_composition',
};

const AdminServicesPricing = () => {
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [salesConfig, setSalesConfig] = useState<SalesConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedPrices, setEditedPrices] = useState<Record<string, number>>({});
  const [editedSaleConfig, setEditedSaleConfig] = useState({
    is_active: false,
    sale_name: "",
    discount_percentage: 0,
    discount_with_engineer: 0,
    discount_without_engineer: 0,
    discount_mixing: 0,
    discount_mastering: 0,
    discount_analog_mastering: 0,
    discount_podcast: 0,
    discount_composition: 0,
  });

  const fetchData = async () => {
    const [servicesRes, salesRes] = await Promise.all([
      supabase.from("services").select("*").order("sort_order"),
      supabase.from("sales_config").select("*").limit(1).single()
    ]);

    if (servicesRes.data) {
      setServices(servicesRes.data);
      const prices: Record<string, number> = {};
      servicesRes.data.forEach(s => { prices[s.id] = s.base_price; });
      setEditedPrices(prices);
    }
    
    if (salesRes.data) {
      const sd = salesRes.data as any;
      setSalesConfig(sd as SalesConfig);
      setEditedSaleConfig({
        is_active: sd.is_active,
        sale_name: sd.sale_name,
        discount_percentage: sd.discount_percentage,
        discount_with_engineer: sd.discount_with_engineer || 0,
        discount_without_engineer: sd.discount_without_engineer || 0,
        discount_mixing: sd.discount_mixing || 0,
        discount_mastering: sd.discount_mastering || 0,
        discount_analog_mastering: sd.discount_analog_mastering || 0,
        discount_podcast: sd.discount_podcast || 0,
        discount_composition: sd.discount_composition || 0,
      });
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSavePrices = async () => {
    setSaving(true);
    
    try {
      const updates = services.map(service => ({
        id: service.id,
        base_price: editedPrices[service.id]
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from("services")
          .update({ base_price: update.base_price })
          .eq("id", update.id);
        
        if (error) throw error;
      }

      toast({ title: "Succès", description: "Prix mis à jour." });
      fetchData();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
    
    setSaving(false);
  };

  const handleSaveSalesConfig = async () => {
    if (!salesConfig) return;
    setSaving(true);
    
    try {
      const { error } = await supabase
        .from("sales_config")
        .update({
          is_active: editedSaleConfig.is_active,
          sale_name: editedSaleConfig.sale_name,
          discount_percentage: editedSaleConfig.discount_percentage,
          discount_with_engineer: editedSaleConfig.discount_with_engineer,
          discount_without_engineer: editedSaleConfig.discount_without_engineer,
          discount_mixing: editedSaleConfig.discount_mixing,
          discount_mastering: editedSaleConfig.discount_mastering,
          discount_analog_mastering: editedSaleConfig.discount_analog_mastering,
          discount_podcast: editedSaleConfig.discount_podcast,
          discount_composition: editedSaleConfig.discount_composition,
        } as any)
        .eq("id", salesConfig.id);

      if (error) throw error;

      toast({ 
        title: "Succès", 
        description: editedSaleConfig.is_active 
          ? `Promotion "${editedSaleConfig.sale_name}" activée`
          : "Promotion désactivée"
      });
      fetchData();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
    
    setSaving(false);
  };

  // Apply general discount to all services
  const applyGlobalDiscount = () => {
    const globalDiscount = editedSaleConfig.discount_percentage;
    setEditedSaleConfig({
      ...editedSaleConfig,
      discount_with_engineer: globalDiscount,
      discount_without_engineer: globalDiscount,
      discount_mixing: globalDiscount,
      discount_mastering: globalDiscount,
      discount_analog_mastering: globalDiscount,
      discount_podcast: globalDiscount,
      discount_composition: globalDiscount,
    });
  };

  // Get the discount for a specific service
  const getServiceDiscount = (serviceKey: string): number => {
    const discountField = serviceKeyToDiscountField[serviceKey];
    if (discountField) {
      return (editedSaleConfig[discountField] as number) || 0;
    }
    return editedSaleConfig.discount_percentage;
  };

  // Update discount for a specific service
  const updateServiceDiscount = (serviceKey: string, value: number) => {
    const discountField = serviceKeyToDiscountField[serviceKey];
    if (discountField) {
      setEditedSaleConfig({
        ...editedSaleConfig,
        [discountField]: value
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Prix des Services */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Euro className="h-5 w-5 text-primary" />
            Prix des Services
          </h2>
          <Button onClick={handleSavePrices} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            Sauvegarder
          </Button>
        </div>

        <div className="space-y-4">
          {services.map((service) => (
            <div key={service.id} className="flex items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">{service.name_fr}</h3>
                <p className="text-sm text-muted-foreground">
                  {service.price_unit === 'hourly' ? 'Par heure' : 'Prix fixe'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={editedPrices[service.id] || 0}
                  onChange={(e) => setEditedPrices({
                    ...editedPrices,
                    [service.id]: parseFloat(e.target.value) || 0
                  })}
                  className="w-24 text-right"
                  step="0.01"
                />
                <span className="text-foreground font-medium">€</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section Promotions/Soldes */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Tag className="h-5 w-5 text-accent" />
            Mode Promotion / Soldes
          </h2>
          <Button onClick={handleSaveSalesConfig} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            Appliquer
          </Button>
        </div>

        <div className="space-y-6">
          {/* Toggle Activation */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              {editedSaleConfig.is_active ? (
                <Power className="h-5 w-5 text-green-500" />
              ) : (
                <PowerOff className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <Label className="font-semibold">Mode Solde</Label>
                <p className="text-sm text-muted-foreground">
                  {editedSaleConfig.is_active ? 'Promotion active' : 'Aucune promotion en cours'}
                </p>
              </div>
            </div>
            <Switch
              checked={editedSaleConfig.is_active}
              onCheckedChange={(checked) => setEditedSaleConfig({
                ...editedSaleConfig,
                is_active: checked
              })}
            />
          </div>

          {/* Nom de la promotion */}
          <div>
            <Label>Nom de la Promotion</Label>
            <Input
              value={editedSaleConfig.sale_name}
              onChange={(e) => setEditedSaleConfig({
                ...editedSaleConfig,
                sale_name: e.target.value
              })}
              placeholder="Ex: Solde de Noël 🎄"
              className="mt-1"
            />
          </div>

          {/* Réduction globale */}
          <div className="p-4 bg-muted/30 rounded-lg border border-border">
            <div className="flex items-center justify-between mb-2">
              <Label className="font-semibold">Réduction globale (appliqué à tous)</Label>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={applyGlobalDiscount}
                className="text-xs"
              >
                Appliquer à tous
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={editedSaleConfig.discount_percentage}
                onChange={(e) => setEditedSaleConfig({
                  ...editedSaleConfig,
                  discount_percentage: parseFloat(e.target.value) || 0
                })}
                min={0}
                max={100}
                className="w-24"
              />
              <Percent className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Réductions par service */}
          <div>
            <Label className="font-semibold mb-3 block">Réductions par Service</Label>
            <div className="grid gap-3">
              {[
                { key: 'with-engineer', label: 'Session avec ingénieur' },
                { key: 'without-engineer', label: 'Location sans ingénieur' },
                { key: 'mixing', label: 'Mixage' },
                { key: 'mastering', label: 'Mastering Numérique' },
                { key: 'analog-mastering', label: 'Mastering Analogique' },
                { key: 'podcast', label: 'Mixage Podcast' },
                { key: 'composition', label: 'Composition' },
              ].map((service) => (
                <div key={service.key} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <span className="text-sm text-foreground">{service.label}</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={getServiceDiscount(service.key)}
                      onChange={(e) => updateServiceDiscount(service.key, parseFloat(e.target.value) || 0)}
                      min={0}
                      max={100}
                      className="w-20 text-right"
                    />
                    <span className="text-muted-foreground text-sm">%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Aperçu */}
          {editedSaleConfig.is_active && (
            <div className="p-4 bg-gradient-to-r from-accent/10 to-primary/10 rounded-lg border border-accent/30">
              <h4 className="font-semibold text-foreground mb-3">Aperçu des prix avec promotion</h4>
              <div className="space-y-2 text-sm">
                {services.map((service) => {
                  const originalPrice = editedPrices[service.id] || service.base_price;
                  const discount = getServiceDiscount(service.service_key);
                  const discountedPrice = originalPrice * (1 - discount / 100);
                  return (
                    <div key={service.id} className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">{service.name_fr}</span>
                      <div className="flex items-center gap-2">
                        {discount > 0 ? (
                          <>
                            <span className="line-through text-muted-foreground">{originalPrice}€</span>
                            <span className="text-accent font-bold">{discountedPrice.toFixed(0)}€</span>
                            <span className="text-green-500 text-xs">(-{discount}%)</span>
                          </>
                        ) : (
                          <span className="text-foreground">{originalPrice}€</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminServicesPricing;