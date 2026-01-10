import { useState, useEffect } from "react";
import { Check, Star, Crown, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface License {
  id: string;
  name: string;
  description: string;
  price: number;
  features: string[];
  sort_order: number;
}

interface Instrumental {
  id: string;
  title: string;
  cover_image_url?: string;
  price_base?: number;
  price_stems?: number;
  price_exclusive?: number;
  has_stems?: boolean;
}

interface LicenseSelectorProps {
  instrumental: Instrumental | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectLicense: (license: License) => void;
}

const licenseIcons: Record<string, React.ReactNode> = {
  Basic: <Zap className="h-6 w-6" />,
  Premium: <Star className="h-6 w-6" />,
  Exclusive: <Crown className="h-6 w-6" />,
};

const licenseColors: Record<string, string> = {
  Basic: "from-blue-500 to-cyan-500",
  Premium: "from-purple-500 to-pink-500",
  Exclusive: "from-amber-500 to-orange-500",
};

const LicenseSelector = ({ instrumental, isOpen, onClose, onSelectLicense }: LicenseSelectorProps) => {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    const fetchLicenses = async () => {
      const { data, error } = await supabase
        .from("instrumental_licenses")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      if (!error && data) {
        // Override prices with instrumental-specific prices if available
        const adjustedLicenses = data.map(license => {
          let adjustedPrice = license.price;
          
          if (instrumental) {
            // Map license names to instrumental price fields
            if (license.name === "Basic" && instrumental.price_base !== undefined && instrumental.price_base !== null) {
              adjustedPrice = instrumental.price_base;
            } else if (license.name === "Premium" && instrumental.price_stems !== undefined && instrumental.price_stems !== null) {
              adjustedPrice = instrumental.price_stems;
            } else if (license.name === "Exclusive" && instrumental.price_exclusive !== undefined && instrumental.price_exclusive !== null) {
              adjustedPrice = instrumental.price_exclusive;
            }
          }
          
          return { ...license, price: adjustedPrice };
        });
        
        // Filter out Premium and Exclusive licenses if instrumental doesn't have stems
        const filteredLicenses = adjustedLicenses.filter(license => {
          if ((license.name === "Premium" || license.name === "Exclusive") && instrumental && !instrumental.has_stems) {
            return false;
          }
          return true;
        });
        
        setLicenses(filteredLicenses);
      }
      setLoading(false);
    };

    if (isOpen) {
      setLoading(true);
      fetchLicenses();
    }
  }, [isOpen, instrumental]);

  if (!instrumental) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            {t("license.choose_title")}
          </DialogTitle>
          <p className="text-center text-muted-foreground">
            {t("license.for")}: <span className="text-primary font-semibold">{instrumental.title}</span>
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className={cn(
            "grid gap-6 mt-6",
            licenses.length === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-3"
          )}>
            {licenses.map((license) => (
              <div
                key={license.id}
                className={cn(
                  "relative rounded-2xl border-2 border-border/50 bg-card/50 backdrop-blur-sm p-6 transition-all duration-300",
                  "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1",
                  license.name === "Premium" && "border-purple-500/50 scale-105",
                  license.name === "Exclusive" && "border-amber-500/50"
                )}
              >
                {license.name === "Premium" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-none">
                      {t("license.with_stems")}
                    </Badge>
                  </div>
                )}
                
                {license.name === "Exclusive" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-none">
                      {t("license.total_exclusivity")}
                    </Badge>
                  </div>
                )}

                {/* Header */}
                <div className="text-center mb-6">
                  <div className={cn(
                    "inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br mb-4",
                    licenseColors[license.name] || "from-gray-500 to-gray-600"
                  )}>
                    {licenseIcons[license.name] || <Star className="h-6 w-6" />}
                  </div>
                  
                  <h3 className="text-xl font-bold text-foreground">{license.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{license.description}</p>
                  
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-foreground">{license.price}€</span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-6">
                  {license.features?.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Button */}
                <Button
                  onClick={() => onSelectLicense(license)}
                  className={cn(
                    "w-full",
                    license.name === "Exclusive" 
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                      : license.name === "Premium"
                      ? "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                      : ""
                  )}
                >
                  {t("license.select")} {license.name}
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// Badge component for tags
const Badge = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <span className={cn("px-3 py-1 text-xs font-semibold rounded-full", className)}>
    {children}
  </span>
);

export default LicenseSelector;
