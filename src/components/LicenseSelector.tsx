import { useState, useEffect } from "react";
import { Check, Star, Crown, Zap, Download, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

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
  const [isTrustedUser, setIsTrustedUser] = useState(false);
  const [downloadingFree, setDownloadingFree] = useState(false);
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();

  // Check if user is trusted
  useEffect(() => {
    const checkTrustedStatus = async () => {
      if (!user) {
        setIsTrustedUser(false);
        return;
      }
      
      // Direct query to trusted_users table (using 'as any' since table may not be in generated types yet)
      try {
        const { data, error } = await (supabase as any)
          .from("trusted_users")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (error) {
          console.error("Error checking trusted status:", error);
          setIsTrustedUser(false);
        } else {
          setIsTrustedUser(!!data);
        }
      } catch (err) {
        console.error("Exception checking trusted status:", err);
        setIsTrustedUser(false);
      }
    };

    if (isOpen) {
      checkTrustedStatus();
    }
  }, [user, isOpen]);

  // Handle free download for trusted users (Basic license only)
  const handleFreeDownload = async () => {
    if (!instrumental || !user || !isTrustedUser) return;
    
    setDownloadingFree(true);
    try {
      // Call the deliver-instrumental function with isFree flag
      const { data, error } = await supabase.functions.invoke("deliver-instrumental", {
        body: {
          instrumentalId: instrumental.id,
          licenseType: "Basic",
          userId: user.id,
          isFreeDownload: true, // Trusted user free download
        }
      });

      if (error) throw error;

      if (data?.downloadUrl) {
        // Open download link
        window.open(data.downloadUrl, "_blank");
        toast({
          title: t("license.free_download_success", "Téléchargement gratuit !"),
          description: t("license.free_download_desc", "Votre instrumentale est en cours de téléchargement."),
        });
        onClose();
      }
    } catch (error: any) {
      console.error("Free download error:", error);
      toast({
        title: t("license.download_error", "Erreur"),
        description: error.message || t("license.download_error_desc", "Impossible de télécharger l'instrumentale."),
        variant: "destructive",
      });
    } finally {
      setDownloadingFree(false);
    }
  };

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

        {/* Free download banner for trusted users */}
        {isTrustedUser && !loading && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-500/30">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-emerald-500/20">
                  <Gift className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="font-semibold text-emerald-400">
                    {t("license.trusted_user_title", "Utilisateur de confiance")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("license.trusted_user_desc", "Vous pouvez télécharger gratuitement cette instrumentale (licence Basic)")}
                  </p>
                </div>
              </div>
              <Button
                onClick={handleFreeDownload}
                disabled={downloadingFree}
                className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600"
              >
                {downloadingFree ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {t("license.free_download", "Télécharger gratuitement")}
              </Button>
            </div>
          </div>
        )}

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
