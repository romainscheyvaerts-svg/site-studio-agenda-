import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  Download,
  Music,
  Loader2,
  Calendar,
  CreditCard,
  FileAudio,
  Layers,
  RefreshCw,
  ShoppingBag,
  LogIn
} from "lucide-react";

interface Purchase {
  id: string;
  created_at: string;
  amount_paid: number;
  download_token: string;
  download_count: number;
  download_expires_at: string;
  payment_method: string | null;
  instrumental: {
    id: string;
    title: string;
    genre: string | null;
    bpm: number | null;
    cover_image_url: string | null;
    has_stems: boolean | null;
    drive_file_id: string;
    stems_folder_id: string | null;
  };
  license: {
    id: string;
    name: string;
    features: string[];
  };
}

const MyPurchases = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      // User not logged in, redirect to auth
      navigate("/auth?redirect=/mes-achats");
      return;
    }

    if (user) {
      fetchPurchases();
    }
  }, [user, authLoading]);

  const fetchPurchases = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("instrumental_purchases")
        .select(`
          id,
          created_at,
          amount_paid,
          download_token,
          download_count,
          download_expires_at,
          payment_method,
          instrumental:instrumentals (
            id,
            title,
            genre,
            bpm,
            cover_image_url,
            has_stems,
            drive_file_id,
            stems_folder_id
          ),
          license:instrumental_licenses (
            id,
            name,
            features
          )
        `)
        .or(`user_id.eq.${user.id},buyer_email.eq.${user.email}`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Transform the data to handle the nested objects
      const transformedData = (data || []).map((item: any) => ({
        ...item,
        instrumental: item.instrumental || {},
        license: item.license || {},
      }));

      setPurchases(transformedData);
    } catch (err) {
      console.error("Error fetching purchases:", err);
      toast({
        title: "Erreur",
        description: "Impossible de charger vos achats",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const regenerateDownloadLink = async (purchaseId: string) => {
    setRegenerating(purchaseId);
    try {
      const { data, error } = await supabase.functions.invoke("regenerate-download", {
        body: { purchaseId },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Lien régénéré !",
          description: "Votre nouveau lien de téléchargement est prêt",
        });
        fetchPurchases(); // Refresh the list
      }
    } catch (err: any) {
      console.error("Error regenerating link:", err);
      toast({
        title: "Erreur",
        description: err.message || "Impossible de régénérer le lien",
        variant: "destructive",
      });
    } finally {
      setRegenerating(null);
    }
  };

  const handleDownload = async (purchase: Purchase, type: "beat" | "stems") => {
    const downloadKey = `${purchase.id}-${type}`;
    setDownloading(downloadKey);

    try {
      // Check if download link is expired
      const isExpired = new Date(purchase.download_expires_at) < new Date();

      if (isExpired) {
        // Regenerate the link first
        await regenerateDownloadLink(purchase.id);
        toast({
          title: "Lien expiré",
          description: "Un nouveau lien a été généré. Cliquez à nouveau pour télécharger.",
        });
        setDownloading(null);
        return;
      }

      // Redirect to download
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const fileId = type === "stems"
        ? purchase.instrumental.stems_folder_id
        : purchase.instrumental.drive_file_id;

      const downloadUrl = `${baseUrl}/functions/v1/deliver-instrumental?token=${purchase.download_token}&type=${type}`;

      window.open(downloadUrl, "_blank");

      toast({
        title: "Téléchargement lancé",
        description: `Votre ${type === "stems" ? "pack stems" : "instrumental"} est en cours de téléchargement`,
      });
    } catch (err) {
      console.error("Download error:", err);
      toast({
        title: "Erreur",
        description: "Impossible de lancer le téléchargement",
        variant: "destructive",
      });
    } finally {
      setDownloading(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const isExpired = (dateStr: string) => {
    return new Date(dateStr) < new Date();
  };

  // License includes stems check
  const licenseIncludesStems = (licenseName: string) => {
    const stemsLicenses = ["stems", "premium", "exclusive", "unlimited"];
    return stemsLicenses.some(s => licenseName.toLowerCase().includes(s));
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center">
          <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-4">Connectez-vous pour voir vos achats</h1>
          <p className="text-muted-foreground mb-6">
            Vous devez être connecté pour accéder à vos instrumentaux achetés.
          </p>
          <Button onClick={() => navigate("/auth?redirect=/mes-achats")}>
            <LogIn className="h-4 w-4 mr-2" />
            Se connecter
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <ShoppingBag className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">Mes Achats</h1>
              <p className="text-muted-foreground">
                Retrouvez et téléchargez vos instrumentaux achetés
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Chargement de vos achats...</span>
            </div>
          ) : purchases.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-xl border border-border">
              <Music className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">Aucun achat</h2>
              <p className="text-muted-foreground mb-6">
                Vous n'avez pas encore acheté d'instrumentaux.
              </p>
              <Button onClick={() => navigate("/instrumentals")}>
                <Music className="h-4 w-4 mr-2" />
                Découvrir les instrumentaux
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {purchases.map((purchase) => {
                const expired = isExpired(purchase.download_expires_at);
                const canDownloadStems = purchase.instrumental.has_stems &&
                  licenseIncludesStems(purchase.license.name);

                return (
                  <div
                    key={purchase.id}
                    className="bg-card rounded-xl border border-border p-6 hover:border-primary/50 transition-colors"
                  >
                    <div className="flex gap-4">
                      {/* Cover */}
                      {purchase.instrumental.cover_image_url ? (
                        <img
                          src={purchase.instrumental.cover_image_url}
                          alt={purchase.instrumental.title}
                          className="w-24 h-24 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-24 h-24 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Music className="h-10 w-10 text-primary/40" />
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-semibold text-lg text-foreground truncate">
                              {purchase.instrumental.title}
                            </h3>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                              {purchase.instrumental.genre && (
                                <span>{purchase.instrumental.genre}</span>
                              )}
                              {purchase.instrumental.bpm && (
                                <span>{purchase.instrumental.bpm} BPM</span>
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="font-bold text-lg text-primary">
                              {purchase.amount_paid}€
                            </span>
                          </div>
                        </div>

                        {/* License & Date */}
                        <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
                          <span className="flex items-center gap-1 text-amber-500 bg-amber-500/10 px-2 py-1 rounded">
                            <CreditCard className="h-3 w-3" />
                            {purchase.license.name}
                          </span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatDate(purchase.created_at)}
                          </span>
                          {purchase.instrumental.has_stems && canDownloadStems && (
                            <span className="flex items-center gap-1 text-green-500 bg-green-500/10 px-2 py-1 rounded">
                              <Layers className="h-3 w-3" />
                              Stems inclus
                            </span>
                          )}
                        </div>

                        {/* Download buttons */}
                        <div className="flex flex-wrap items-center gap-2 mt-4">
                          {/* Download Beat */}
                          <Button
                            size="sm"
                            onClick={() => handleDownload(purchase, "beat")}
                            disabled={downloading === `${purchase.id}-beat`}
                          >
                            {downloading === `${purchase.id}-beat` ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4 mr-2" />
                            )}
                            Télécharger l'instrumental
                          </Button>

                          {/* Download Stems (if applicable) */}
                          {canDownloadStems && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownload(purchase, "stems")}
                              disabled={downloading === `${purchase.id}-stems`}
                              className="text-green-500 border-green-500/50 hover:bg-green-500/10"
                            >
                              {downloading === `${purchase.id}-stems` ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Layers className="h-4 w-4 mr-2" />
                              )}
                              Télécharger les stems
                            </Button>
                          )}

                          {/* Regenerate link if expired */}
                          {expired && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => regenerateDownloadLink(purchase.id)}
                              disabled={regenerating === purchase.id}
                              className="text-muted-foreground"
                            >
                              {regenerating === purchase.id ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4 mr-2" />
                              )}
                              Régénérer le lien
                            </Button>
                          )}
                        </div>

                        {/* Expiration warning */}
                        {expired && (
                          <p className="text-xs text-amber-500 mt-2">
                            Lien expiré - Cliquez sur "Régénérer le lien" ou téléchargez directement
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Help section */}
          {purchases.length > 0 && (
            <div className="mt-8 p-4 bg-muted/30 rounded-lg border border-border">
              <h4 className="font-semibold text-foreground mb-2">Besoin d'aide ?</h4>
              <p className="text-sm text-muted-foreground">
                Vos achats sont sauvegardés de façon permanente. Si un lien de téléchargement
                expire, cliquez simplement sur le bouton de téléchargement pour en générer un nouveau.
                Pour toute question, contactez-nous à{" "}
                <a href="mailto:prod.makemusic@gmail.com" className="text-primary hover:underline">
                  prod.makemusic@gmail.com
                </a>
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default MyPurchases;
