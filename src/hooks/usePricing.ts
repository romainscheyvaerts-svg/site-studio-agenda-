import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Service {
  id: string;
  service_key: string;
  name_fr: string;
  base_price: number;
  price_unit: string;
  is_active: boolean;
  sort_order: number;
  category: string; // "studio" | "post-production" | "other"
  requires_calendar: boolean;
  requires_identity: boolean;
  deposit_type: string; // "full" | "half" | "fixed" | "none"
  deposit_fixed_amount: number;
  description_fr: string;
  icon_name: string;
  color: string; // "primary" | "accent" | "pink" | "green" | etc.
}

interface SalesConfig {
  is_active: boolean;
  sale_name: string;
  discount_percentage: number;
  discount_with_engineer: number | null;
  discount_without_engineer: number | null;
  discount_mixing: number | null;
  discount_mastering: number | null;
  discount_analog_mastering: number | null;
  discount_podcast: number | null;
  discount_composition: number | null;
}

// Mapping service_key to discount field (using DB format with dashes)
const serviceKeyToDiscountField: Record<string, keyof SalesConfig> = {
  'with-engineer': 'discount_with_engineer',
  'without-engineer': 'discount_without_engineer',
  'mixing': 'discount_mixing',
  'mastering': 'discount_mastering',
  'analog-mastering': 'discount_analog_mastering',
  'podcast': 'discount_podcast',
  'composition': 'discount_composition',
};

export const usePricing = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [salesConfig, setSalesConfig] = useState<SalesConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [servicesRes, salesRes] = await Promise.all([
          supabase.from("services").select("*").eq("is_active", true).order("sort_order"),
          supabase.from("sales_config").select("*").limit(1).single(),
        ]);

        if (servicesRes.data) {
          // Map DB data with defaults for new columns
          const mapped = servicesRes.data.map((s: any) => ({
            id: s.id,
            service_key: s.service_key,
            name_fr: s.name_fr,
            base_price: Number(s.base_price) || 0,
            price_unit: s.price_unit || '/h',
            is_active: s.is_active ?? true,
            sort_order: s.sort_order || 0,
            category: s.category || 'studio',
            requires_calendar: s.requires_calendar ?? true,
            requires_identity: s.requires_identity ?? true,
            deposit_type: s.deposit_type || 'half',
            deposit_fixed_amount: Number(s.deposit_fixed_amount) || 0,
            description_fr: s.description_fr || '',
            icon_name: s.icon_name || 'Mic',
            color: s.color || 'primary',
          }));
          setServices(mapped);
        }
        if (salesRes.data) {
          setSalesConfig(salesRes.data as any);
        }
      } catch (error) {
        console.error("Error fetching pricing data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Get base price for a service (by service_key)
  const getPrice = (serviceKey: string): number => {
    const normalizedKey = serviceKey.replace(/_/g, '-');
    const service = services.find(s => s.service_key === normalizedKey);
    return service?.base_price || 0;
  };

  // Get discounted price if sales are active
  const getDiscountedPrice = (serviceKey: string): number | null => {
    if (!salesConfig?.is_active) return null;
    
    const normalizedKey = serviceKey.replace(/_/g, '-');
    const basePrice = getPrice(normalizedKey);
    if (!basePrice) return null;
    
    const discountField = serviceKeyToDiscountField[normalizedKey];
    const specificDiscount = discountField ? (salesConfig[discountField] as number | null) : null;
    const discount = specificDiscount ?? salesConfig.discount_percentage ?? 0;
    
    if (discount > 0) {
      return Math.round(basePrice * (1 - discount / 100));
    }
    return null;
  };

  // Get effective price (discounted if sale active, otherwise base)
  const getEffectivePrice = (serviceKey: string): number => {
    const normalizedKey = serviceKey.replace(/_/g, '-');
    return getDiscountedPrice(normalizedKey) ?? getPrice(normalizedKey);
  };

  // Get discount percentage for a service
  const getDiscountPercent = (serviceKey: string): number => {
    if (!salesConfig?.is_active) return 0;
    
    const normalizedKey = serviceKey.replace(/_/g, '-');
    const discountField = serviceKeyToDiscountField[normalizedKey];
    const specificDiscount = discountField ? (salesConfig[discountField] as number | null) : null;
    return specificDiscount ?? salesConfig.discount_percentage ?? 0;
  };

  // Pricing object for backward compatibility
  const pricing: Record<string, number> = useMemo(() => {
    const result: Record<string, number> = {};
    services.forEach(service => {
      result[service.service_key] = service.base_price;
    });
    return result;
  }, [services]);

  // Effective pricing (with discounts applied if active)
  const effectivePricing: Record<string, number> = useMemo(() => {
    const result: Record<string, number> = {};
    services.forEach(service => {
      result[service.service_key] = getEffectivePrice(service.service_key);
    });
    return result;
  }, [services, salesConfig]);

  // Group services by category
  const servicesByCategory = useMemo(() => {
    const groups: Record<string, Service[]> = {};
    services.forEach(service => {
      const cat = service.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(service);
    });
    return groups;
  }, [services]);

  return {
    services,
    salesConfig,
    loading,
    pricing,
    effectivePricing,
    servicesByCategory,
    getPrice,
    getDiscountedPrice,
    getEffectivePrice,
    getDiscountPercent,
    isSaleActive: salesConfig?.is_active ?? false,
    saleName: salesConfig?.sale_name ?? "",
  };
};